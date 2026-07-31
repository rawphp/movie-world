import { access } from 'node:fs/promises'
import type { LibraryLoadResult, MovieRecord, ScanProgress } from '../../shared/types'
import type { SettingsStore } from '../settings'
import type { TmdbClient } from '../tmdb/client'
import { createFetchQueue, fetchAndApply, downloadImageToFile } from '../tmdb/fetcher'
import { playMovie } from '../player'
import {
  backfillCacheArtFromSource,
  discoverVideoFiles as defaultDiscoverVideoFiles,
  ingestFile as defaultIngestFile,
  needsCacheArtBackfill
} from './scanner'
import { completeCachedArtworkPaths, createLibraryCache } from './cache'
import { measureAsync, type TimingSink } from '../startup-timings'

/** Max concurrent Drive→cache art mirrors during startup backfill (UR-011 / REQ-046). */
const CACHE_ART_BACKFILL_CONCURRENCY = 2

async function defaultFolderExists(folder: string): Promise<boolean> {
  try {
    await access(folder)
    return true
  } catch {
    return false
  }
}

interface ManagerOpts {
  settings: SettingsStore
  makeClient: (apiKey: string) => TmdbClient
  emit: (channel: 'movie:updated' | 'scan:progress', payload: MovieRecord | ScanProgress) => void
  appDataPath?: string
  scanDeps?: {
    discoverVideoFiles?: typeof defaultDiscoverVideoFiles
    ingestFile?: typeof defaultIngestFile
    /** Injectable folder probe (async) for tests / non-blocking Drive roots. */
    folderExists?: (folder: string) => boolean | Promise<boolean>
  }
  downloadImage?: (url: string, dest: string) => Promise<void>
  playDeps?: { openPath?: (p: string) => Promise<string>; now?: () => Date }
  /** Optional sink for startup stage timings (REQ-037 diagnosis). */
  onTiming?: TimingSink
}

export interface LibraryManager {
  loadLibrary(): Promise<LibraryLoadResult>
  rescanFolder(folder: string): Promise<void>
  fixMatch(id: string, tmdbId: number): Promise<void>
  retryFetch(id: string): Promise<void>
  play(id: string): Promise<void>
  getMovies(): MovieRecord[]
  idle(): Promise<void>
}

export function createLibraryManager(opts: ManagerOpts): LibraryManager {
  const movies = new Map<string, MovieRecord>()
  const cache = opts.appDataPath ? createLibraryCache(opts.appDataPath) : null
  const discoverVideoFiles = opts.scanDeps?.discoverVideoFiles ?? defaultDiscoverVideoFiles
  const ingestFile = opts.scanDeps?.ingestFile ?? defaultIngestFile
  const folderExists = opts.scanDeps?.folderExists ?? defaultFolderExists
  const downloadImage = opts.downloadImage ?? downloadImageToFile
  const startupScans = new Set<Promise<void>>()

  // Startup cache-art backfill pool (concurrency 2): never blocks loadLibrary.
  const backfillWaiting: MovieRecord[] = []
  let backfillActive = 0
  let backfillIdleResolvers: Array<() => void> = []

  function client(): TmdbClient | null {
    const key = opts.settings.read().tmdbApiKey
    return key ? opts.makeClient(key) : null
  }

  function commit(movie: MovieRecord): void {
    movies.set(movie.id, movie)
    opts.emit('movie:updated', movie)
    void persistCache().catch(() => undefined)
  }

  async function persistCache(): Promise<void> {
    await cache?.write([...movies.values()])
  }

  function notifyBackfillIdle(): void {
    if (backfillActive === 0 && backfillWaiting.length === 0) {
      backfillIdleResolvers.forEach((r) => r())
      backfillIdleResolvers = []
    }
  }

  async function runCacheArtBackfill(movie: MovieRecord): Promise<void> {
    backfillActive++
    try {
      const appDataPath = opts.appDataPath
      if (!appDataPath) return
      const current = movies.get(movie.id) ?? movie
      const updated = backfillCacheArtFromSource(current, appDataPath)
      if (
        updated.cachedPosterPath !== (current.cachedPosterPath ?? null) ||
        updated.cachedFanartPath !== (current.cachedFanartPath ?? null)
      ) {
        // Merge onto latest map entry so concurrent match/fetch updates are not clobbered.
        const latest = movies.get(movie.id) ?? current
        commit({
          ...latest,
          cachedPosterPath: updated.cachedPosterPath,
          cachedFanartPath: updated.cachedFanartPath
        })
      }
    } catch {
      // Best-effort: never reject loadLibrary / startup path (REQ-046).
    } finally {
      backfillActive--
      pumpCacheArtBackfill()
    }
  }

  function pumpCacheArtBackfill(): void {
    while (backfillActive < CACHE_ART_BACKFILL_CONCURRENCY && backfillWaiting.length > 0) {
      void runCacheArtBackfill(backfillWaiting.shift()!)
    }
    notifyBackfillIdle()
  }

  function scheduleCacheArtBackfill(movie: MovieRecord): void {
    if (!opts.appDataPath) return
    if (!needsCacheArtBackfill(movie)) return
    // Dedupe by id while waiting/running.
    if (backfillWaiting.some((m) => m.id === movie.id)) return
    backfillWaiting.push(movie)
    pumpCacheArtBackfill()
  }

  function waitForCacheArtBackfill(): Promise<void> {
    if (backfillActive === 0 && backfillWaiting.length === 0) return Promise.resolve()
    return new Promise((resolve) => {
      backfillIdleResolvers.push(resolve)
    })
  }

  async function hydrateFromCache(): Promise<MovieRecord[]> {
    return measureAsync(
      'hydrateFromCache',
      async () => {
        if (!cache || !opts.appDataPath) return []
        const folders = new Set(opts.settings.read().folders)
        const appDataPath = opts.appDataPath
        // Complete cached art fields from app-owned sidecars so first paint never
        // falls back to Drive posterPath when the mirror already exists (REQ-040).
        // When any field is filled, persist so the next launch is a no-op (REQ-045).
        let anyCompleted = false
        const cached = (await cache.read())
          .filter((movie) => folders.has(movie.folderPath))
          .map((movie) => {
            const completed = completeCachedArtworkPaths(movie, appDataPath)
            if (completed !== movie) anyCompleted = true
            return completed
          })
        movies.clear()
        for (const movie of cached) movies.set(movie.id, movie)
        if (anyCompleted) await persistCache()
        return cached
      },
      { sink: opts.onTiming }
    )
  }

  // Queue is rebuilt lazily so a newly-entered API key takes effect.
  let queue: ReturnType<typeof createFetchQueue> | null = null
  function ensureQueue(): ReturnType<typeof createFetchQueue> | null {
    const c = client()
    if (!c) return null
    if (!queue)
      queue = createFetchQueue({
        client: c,
        onUpdate: commit,
        downloadImage,
        appDataPath: opts.appDataPath
      })
    return queue
  }

  async function scanOne(
    folder: string,
    { markMissing }: { markMissing: boolean }
  ): Promise<MovieRecord[]> {
    // Async folder probe (not sync existsSync) so cloud-provider roots cannot
    // stall the Electron main thread while startup scans run in the background.
    const available = await folderExists(folder)
    if (!available) {
      if (markMissing) {
        for (const m of movies.values()) {
          if (m.folderPath === folder && !m.fileMissing) commit({ ...m, fileMissing: true })
        }
        await persistCache()
      }
      opts.emit('scan:progress', {
        folder,
        discovered: 0,
        ingested: 0,
        done: true,
        unavailable: true
      })
      return []
    }
    const files = await measureAsync('discoverVideoFiles', () => discoverVideoFiles(folder), {
      sink: opts.onTiming,
      detail: folder
    })
    const seen = new Set<string>()
    const ingested: MovieRecord[] = []
    let done = 0
    // Startup (markMissing:false): prefer app-owned cache — no Drive sidecar probes
    // when NFO/art already cached. Explicit rescan fully reconciles from source.
    const preferCache = !markMissing
    for (const file of files) {
      const existing = [...movies.values()].find((m) => m.filePath === file)
      const record = existing
        ? { ...existing, fileMissing: false }
        : await measureAsync(
            'ingestFile',
            () =>
              ingestFile(file, folder, {
                appDataPath: opts.appDataPath,
                preferCache
              }),
            { sink: opts.onTiming, detail: file }
          )
      seen.add(record.id)
      if (!existing || existing.fileMissing) commit(record)
      // Startup only: re-touch known records missing usable cache art (async pool).
      // Brand-new files already materialize via ingestFile; do not mark missing here.
      if (existing && !markMissing && opts.appDataPath) {
        scheduleCacheArtBackfill(record)
      }
      ingested.push(record)
      opts.emit('scan:progress', {
        folder,
        discovered: files.length,
        ingested: ++done,
        done: false
      })
    }
    if (markMissing) {
      for (const m of movies.values()) {
        if (m.folderPath === folder && !seen.has(m.id) && !m.fileMissing) {
          commit({ ...m, fileMissing: true })
        }
      }
    }
    await persistCache()
    opts.emit('scan:progress', { folder, discovered: files.length, ingested: done, done: true })
    const q = ensureQueue()
    if (q) for (const m of ingested) if (m.matchStatus === 'pending') q.enqueue(m)
    return ingested
  }

  function scheduleStartupScan(folder: string): void {
    const scan: Promise<void> = scanOne(folder, { markMissing: false })
      .then(
        () => undefined,
        () => undefined
      )
      .finally(() => {
        startupScans.delete(scan)
      })
    startupScans.add(scan)
  }

  async function waitForStartupScans(): Promise<void> {
    while (startupScans.size > 0) await Promise.all([...startupScans])
  }

  return {
    async loadLibrary(): Promise<LibraryLoadResult> {
      return measureAsync(
        'loadLibrary',
        async () => {
          const cached = await hydrateFromCache()
          const folders = opts.settings.read().folders
          for (const folder of folders) scheduleStartupScan(folder)
          // Do not sync-probe folder roots here (Drive cloud-only roots can hang).
          // Background scan reports unavailable via scan:progress; renderer updates UX.
          return {
            movies: cached,
            status: {
              firstViewFromCache: cached.length > 0,
              backgroundScanRunning: folders.length > 0,
              backgroundScanFolders: folders,
              unavailableFolders: []
            }
          }
        },
        { sink: opts.onTiming }
      )
    },
    rescanFolder: async (folder: string): Promise<void> => {
      await scanOne(folder, { markMissing: true })
    },
    async fixMatch(id: string, tmdbId: number): Promise<void> {
      const movie = movies.get(id)
      const c = client()
      if (!movie || !c) return
      commit(await fetchAndApply(movie, c, downloadImage, tmdbId, opts.appDataPath))
    },
    async retryFetch(id: string): Promise<void> {
      const movie = movies.get(id)
      const q = ensureQueue()
      if (movie && q) q.enqueue({ ...movie, fetchFailed: false })
    },
    async play(id: string): Promise<void> {
      const movie = movies.get(id)
      if (movie) commit(await playMovie(movie, opts.playDeps))
    },
    getMovies: (): MovieRecord[] => [...movies.values()],
    idle: async (): Promise<void> => {
      await waitForStartupScans()
      await waitForCacheArtBackfill()
      await (queue?.idle() ?? Promise.resolve())
    }
  }
}

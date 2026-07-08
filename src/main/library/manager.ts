import { existsSync } from 'node:fs'
import type { MovieRecord, ScanProgress } from '../../shared/types'
import type { SettingsStore } from '../settings'
import type { TmdbClient } from '../tmdb/client'
import { createFetchQueue, fetchAndApply, downloadImageToFile } from '../tmdb/fetcher'
import { playMovie } from '../player'
import { discoverVideoFiles, ingestFile } from './scanner'

interface ManagerOpts {
  settings: SettingsStore
  makeClient: (apiKey: string) => TmdbClient
  emit: (channel: 'movie:updated' | 'scan:progress', payload: MovieRecord | ScanProgress) => void
  downloadImage?: (url: string, dest: string) => Promise<void>
  playDeps?: { openPath?: (p: string) => Promise<string>; now?: () => Date }
}

export interface LibraryManager {
  loadLibrary(): Promise<MovieRecord[]>
  rescanFolder(folder: string): Promise<void>
  fixMatch(id: string, tmdbId: number): Promise<void>
  retryFetch(id: string): Promise<void>
  play(id: string): Promise<void>
  getMovies(): MovieRecord[]
  idle(): Promise<void>
}

export function createLibraryManager(opts: ManagerOpts): LibraryManager {
  const movies = new Map<string, MovieRecord>()
  const downloadImage = opts.downloadImage ?? downloadImageToFile

  function client(): TmdbClient | null {
    const key = opts.settings.read().tmdbApiKey
    return key ? opts.makeClient(key) : null
  }

  function commit(movie: MovieRecord): void {
    movies.set(movie.id, movie)
    opts.emit('movie:updated', movie)
  }

  // Queue is rebuilt lazily so a newly-entered API key takes effect.
  let queue: ReturnType<typeof createFetchQueue> | null = null
  function ensureQueue(): ReturnType<typeof createFetchQueue> | null {
    const c = client()
    if (!c) return null
    if (!queue) queue = createFetchQueue({ client: c, onUpdate: commit, downloadImage })
    return queue
  }

  async function scanOne(folder: string): Promise<MovieRecord[]> {
    if (!existsSync(folder)) return []
    const files = await discoverVideoFiles(folder)
    const seen = new Set<string>()
    const ingested: MovieRecord[] = []
    let done = 0
    for (const file of files) {
      const existing = [...movies.values()].find((m) => m.filePath === file)
      const record = existing ?? (await ingestFile(file, folder))
      seen.add(record.id)
      if (!existing) commit(record)
      ingested.push(record)
      opts.emit('scan:progress', {
        folder,
        discovered: files.length,
        ingested: ++done,
        done: false
      })
    }
    for (const m of movies.values()) {
      if (m.folderPath === folder && !seen.has(m.id) && !m.fileMissing) {
        commit({ ...m, fileMissing: true })
      }
    }
    opts.emit('scan:progress', { folder, discovered: files.length, ingested: done, done: true })
    const q = ensureQueue()
    if (q) for (const m of ingested) if (m.matchStatus === 'pending') q.enqueue(m)
    return ingested
  }

  return {
    async loadLibrary(): Promise<MovieRecord[]> {
      for (const folder of opts.settings.read().folders) await scanOne(folder)
      return [...movies.values()]
    },
    rescanFolder: async (folder: string): Promise<void> => {
      await scanOne(folder)
    },
    async fixMatch(id: string, tmdbId: number): Promise<void> {
      const movie = movies.get(id)
      const c = client()
      if (!movie || !c) return
      commit(await fetchAndApply(movie, c, downloadImage, tmdbId))
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
    idle: (): Promise<void> => queue?.idle() ?? Promise.resolve()
  }
}

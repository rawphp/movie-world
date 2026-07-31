import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { createLibraryManager, type LibraryManager } from '../manager'
import { createSettingsStore } from '../../settings'
import { movieId } from '../scanner'
import { createLibraryCache } from '../cache'
import { cachedSidecarPathsFor } from '../nfo'
import type { LibraryLoadResult, MovieRecord, ScanProgress } from '../../../shared/types'
import type { TmdbClient } from '../../tmdb/client'
import { createTimingBuffer, classifyStartupFreeze } from '../../startup-timings'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mw-mgr-'))
  return () => rmSync(dir, { recursive: true, force: true })
})

const fakeClient = {
  searchMovies: vi.fn(async () => [{ id: 603, title: 'The Matrix', release_date: '1999-03-30' }]),
  getMovieDetails: vi.fn(async () => ({ id: 603, title: 'The Matrix', release_date: '1999-03-30' }))
} as unknown as TmdbClient

function makeManager(): {
  manager: LibraryManager
  settings: ReturnType<typeof createSettingsStore>
  updates: MovieRecord[]
  progress: ScanProgress[]
  appDataPath: string
} {
  const settingsFile = join(dir, 'settings.json')
  const appDataPath = join(dir, 'app-data')
  const settings = createSettingsStore(settingsFile)
  settings.setApiKey('KEY')
  settings.addFolder(join(dir, 'movies'))
  const updates: MovieRecord[] = []
  const progress: ScanProgress[] = []
  const manager = createLibraryManager({
    settings,
    makeClient: () => fakeClient,
    emit: (channel, payload) => {
      if (channel === 'movie:updated') updates.push(payload as MovieRecord)
      else progress.push(payload as ScanProgress)
    },
    appDataPath,
    downloadImage: async () => {}
  })
  return { manager, settings, updates, progress, appDataPath }
}

function makeMovie(overrides: Partial<MovieRecord> = {}): MovieRecord {
  const filePath = overrides.filePath ?? join(dir, 'movies', 'Cached.Movie.2020.mkv')
  return {
    id: overrides.id ?? movieId(filePath),
    filePath,
    fileSize: 10,
    folderPath: join(dir, 'movies'),
    parsedTitle: 'Cached Movie',
    parsedYear: 2020,
    matchStatus: 'matched',
    tmdbId: 1,
    title: 'Cached Movie',
    originalTitle: 'Cached Movie',
    year: 2020,
    overview: null,
    runtime: null,
    voteAverage: null,
    genres: [],
    cast: [],
    certifications: {},
    certificationAu: null,
    trailerYoutubeKey: null,
    playCount: 0,
    lastPlayedAt: null,
    fileMissing: false,
    sidecarWriteFailed: false,
    fetchFailed: false,
    posterPath: null,
    fanartPath: null,
    ...overrides
  }
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('library manager', () => {
  it('returns cached records before a slow startup scan completes', async () => {
    const { mkdirSync } = await import('node:fs')
    const moviesDir = join(dir, 'movies')
    mkdirSync(moviesDir, { recursive: true })
    const { promise, resolve } = deferred<string[]>()
    const { appDataPath } = makeManager()
    const cached = makeMovie()
    await createLibraryCache(appDataPath).write([cached])

    const settings = createSettingsStore(join(dir, 'settings.json'))
    settings.addFolder(moviesDir)
    const manager = createLibraryManager({
      settings,
      makeClient: () => fakeClient,
      emit: () => {},
      appDataPath,
      scanDeps: {
        discoverVideoFiles: () => promise,
        ingestFile: async (file, folder) => makeMovie({ filePath: file, folderPath: folder })
      }
    })
    const loaded = await manager.loadLibrary()

    expect(loaded).toEqual({
      movies: [cached],
      status: {
        firstViewFromCache: true,
        backgroundScanRunning: true,
        backgroundScanFolders: [moviesDir],
        unavailableFolders: []
      }
    })
    resolve([])
    await manager.idle()
  })

  it('reports offline startup folders through scan progress without clearing cached records', async () => {
    const missingFolder = join(dir, 'offline-drive')
    const settings = createSettingsStore(join(dir, 'settings.json'))
    settings.addFolder(missingFolder)
    const appDataPath = join(dir, 'app-data')
    const cached = makeMovie({
      filePath: join(missingFolder, 'Cached.Movie.2020.mkv'),
      folderPath: missingFolder,
      fileMissing: false
    })
    await createLibraryCache(appDataPath).write([cached])
    const progress: ScanProgress[] = []
    const manager = createLibraryManager({
      settings,
      makeClient: () => fakeClient,
      emit: (channel, payload) => {
        if (channel === 'scan:progress') progress.push(payload as ScanProgress)
      },
      appDataPath
    })

    const loaded = await manager.loadLibrary()
    await manager.idle()

    expect((loaded as LibraryLoadResult).movies).toEqual([cached])
    expect(progress).toContainEqual({
      folder: missingFolder,
      discovered: 0,
      ingested: 0,
      done: true,
      unavailable: true
    })
  })

  it('runs startup scans in the background and emits update and progress events', async () => {
    const { mkdirSync } = await import('node:fs')
    const moviesDir = join(dir, 'movies')
    mkdirSync(moviesDir, { recursive: true })
    const file = join(moviesDir, 'Arrival.2016.mkv')
    const discovered = deferred<string[]>()
    const updates: MovieRecord[] = []
    const progress: ScanProgress[] = []
    const settings = createSettingsStore(join(dir, 'settings.json'))
    settings.addFolder(moviesDir)
    const manager = createLibraryManager({
      settings,
      makeClient: () => fakeClient,
      emit: (channel, payload) => {
        if (channel === 'movie:updated') updates.push(payload as MovieRecord)
        else progress.push(payload as ScanProgress)
      },
      appDataPath: join(dir, 'app-data'),
      scanDeps: {
        discoverVideoFiles: () => discovered.promise,
        ingestFile: async (path, folder) =>
          makeMovie({
            id: movieId(path),
            filePath: path,
            folderPath: folder,
            parsedTitle: 'Arrival',
            parsedYear: 2016,
            matchStatus: 'pending',
            tmdbId: null,
            title: null,
            originalTitle: null,
            year: null
          })
      }
    })

    await expect(manager.loadLibrary()).resolves.toMatchObject({
      movies: [],
      status: { firstViewFromCache: false, backgroundScanRunning: true }
    })
    expect(updates).toHaveLength(0)

    discovered.resolve([file])
    await manager.idle()

    expect(updates.some((m) => m.filePath === file)).toBe(true)
    expect(progress.at(-1)).toMatchObject({
      folder: moviesDir,
      discovered: 1,
      ingested: 1,
      done: true
    })
  })

  it('keeps cached records visible when a startup folder is offline', async () => {
    const missingFolder = join(dir, 'offline-drive')
    const settings = createSettingsStore(join(dir, 'settings.json'))
    settings.addFolder(missingFolder)
    const appDataPath = join(dir, 'app-data')
    const cached = makeMovie({
      filePath: join(missingFolder, 'Cached.Movie.2020.mkv'),
      folderPath: missingFolder,
      fileMissing: false
    })
    await createLibraryCache(appDataPath).write([cached])
    const updates: MovieRecord[] = []
    const manager = createLibraryManager({
      settings,
      makeClient: () => fakeClient,
      emit: (channel, payload) => {
        if (channel === 'movie:updated') updates.push(payload as MovieRecord)
      },
      appDataPath
    })

    const loaded = await manager.loadLibrary()
    await manager.idle()

    expect(loaded.movies).toEqual([cached])
    expect(manager.getMovies()).toEqual([cached])
    expect(updates.some((m) => m.fileMissing)).toBe(false)
  })

  it('loads from disk in the background, then emits matched updates', async () => {
    const moviesDir = join(dir, 'movies')
    const { mkdirSync } = await import('node:fs')
    mkdirSync(moviesDir, { recursive: true })
    const file = join(moviesDir, 'The.Matrix.1999.mkv')
    writeFileSync(file, 'x')

    const { manager, updates } = makeManager()
    const initial = await manager.loadLibrary()
    expect(initial.movies).toEqual([])
    await manager.idle()
    expect(updates.at(-1)!.matchStatus).toBe('matched')
    expect(manager.getMovies()[0].tmdbId).toBe(603)
  })

  it('rescan flags vanished files as missing', async () => {
    const { mkdirSync } = await import('node:fs')
    const moviesDir = join(dir, 'movies')
    mkdirSync(moviesDir, { recursive: true })
    const file = join(moviesDir, 'Alien.mkv')
    writeFileSync(file, 'x')
    const { manager, updates } = makeManager()
    await manager.loadLibrary()
    await manager.idle()
    unlinkSync(file)
    await manager.rescanFolder(moviesDir)
    const flagged = updates.find((m) => m.id === movieId(file) && m.fileMissing)
    expect(flagged).toBeDefined()
  })

  it('fixMatch fetches the supplied tmdb id and emits matched', async () => {
    const { mkdirSync } = await import('node:fs')
    const moviesDir = join(dir, 'movies')
    mkdirSync(moviesDir, { recursive: true })
    const file = join(moviesDir, 'Obscure Film.mkv')
    writeFileSync(file, 'x')
    const { manager, updates } = makeManager()
    await manager.loadLibrary()
    await manager.idle()
    await manager.fixMatch(movieId(file), 603)
    expect(updates.at(-1)!).toMatchObject({ tmdbId: 603, matchStatus: 'matched' })
  })

  it('emits timings for hydrateFromCache, loadLibrary, discoverVideoFiles, and ingestFile', async () => {
    const { mkdirSync } = await import('node:fs')
    const moviesDir = join(dir, 'movies')
    mkdirSync(moviesDir, { recursive: true })
    const cachedFile = join(moviesDir, 'Cached.Movie.2020.mkv')
    // New discovery forces ingestFile (existing cache hits skip ingest).
    const newFile = join(moviesDir, 'Arrival.2016.mkv')
    const buffer = createTimingBuffer()
    const appDataPath = join(dir, 'app-data')
    const cached = makeMovie({ filePath: cachedFile, folderPath: moviesDir })
    await createLibraryCache(appDataPath).write([cached])
    const settings = createSettingsStore(join(dir, 'settings.json'))
    settings.addFolder(moviesDir)
    const manager = createLibraryManager({
      settings,
      makeClient: () => fakeClient,
      emit: () => {},
      appDataPath,
      onTiming: buffer.sink,
      scanDeps: {
        discoverVideoFiles: async () => [newFile],
        ingestFile: async (path, folder) =>
          makeMovie({ filePath: path, folderPath: folder, matchStatus: 'matched' })
      }
    })

    await manager.loadLibrary()
    await manager.idle()

    expect(buffer.durationsFor('hydrateFromCache').length).toBe(1)
    expect(buffer.durationsFor('loadLibrary').length).toBe(1)
    expect(buffer.durationsFor('discoverVideoFiles').length).toBe(1)
    expect(buffer.events.find((e) => e.stage === 'discoverVideoFiles')?.detail).toBe(moviesDir)
    expect(buffer.durationsFor('ingestFile').length).toBe(1)
    expect(buffer.events.find((e) => e.stage === 'ingestFile')?.detail).toBe(newFile)
  })

  it('does not wait on slow discoverVideoFiles before loadLibrary returns (scan is not UI-critical)', async () => {
    const { mkdirSync } = await import('node:fs')
    const moviesDir = join(dir, 'movies')
    mkdirSync(moviesDir, { recursive: true })
    const buffer = createTimingBuffer()
    const appDataPath = join(dir, 'app-data')
    const cached = makeMovie({ folderPath: moviesDir })
    await createLibraryCache(appDataPath).write([cached])
    const settings = createSettingsStore(join(dir, 'settings.json'))
    settings.addFolder(moviesDir)
    const { promise, resolve } = deferred<string[]>()
    const discoverDelayMs = 150
    const manager = createLibraryManager({
      settings,
      makeClient: () => fakeClient,
      emit: () => {},
      appDataPath,
      onTiming: buffer.sink,
      scanDeps: {
        discoverVideoFiles: async () => {
          await new Promise((r) => setTimeout(r, discoverDelayMs))
          return promise
        },
        ingestFile: async (path, folder) => makeMovie({ filePath: path, folderPath: folder })
      }
    })

    const loadStart = performance.now()
    const loaded = await manager.loadLibrary()
    const loadWallMs = performance.now() - loadStart

    expect(loaded.movies).toEqual([cached])
    // loadLibrary must return well before the slow discover finishes.
    expect(loadWallMs).toBeLessThan(discoverDelayMs)
    const loadLibraryMs = buffer.durationsFor('loadLibrary')[0] ?? Number.POSITIVE_INFINITY
    expect(loadLibraryMs).toBeLessThan(discoverDelayMs)

    resolve([])
    await manager.idle()
    const discoverMs = buffer.durationsFor('discoverVideoFiles')[0] ?? 0
    expect(discoverMs).toBeGreaterThanOrEqual(discoverDelayMs - 20)

    // Background scan is slow but loadLibrary did not wait — freeze after paint
    // is not explained by loadLibrary awaiting discover (points at serveArtFile).
    expect(
      classifyStartupFreeze({
        loadLibraryMs,
        backgroundDiscoverMs: discoverMs,
        serveArtFileMs: 200,
        loadLibraryWaitedOnDiscover: false,
        blockingMs: 100
      })
    ).toBe('a_mw_art_sync_reads')
  })

  it('does not await slow folder probes inside loadLibrary; unavailable is reported via scan progress (REQ-039)', async () => {
    const missingFolder = join(dir, 'cloud-only-drive')
    const settings = createSettingsStore(join(dir, 'settings.json'))
    settings.addFolder(missingFolder)
    const appDataPath = join(dir, 'app-data')
    const cached = makeMovie({
      filePath: join(missingFolder, 'Cached.Movie.2020.mkv'),
      folderPath: missingFolder,
      fileMissing: false
    })
    await createLibraryCache(appDataPath).write([cached])
    const progress: ScanProgress[] = []
    let folderExistsCalls = 0
    const probeDelayMs = 80
    const manager = createLibraryManager({
      settings,
      makeClient: () => fakeClient,
      emit: (channel, payload) => {
        if (channel === 'scan:progress') progress.push(payload as ScanProgress)
      },
      appDataPath,
      scanDeps: {
        folderExists: async () => {
          folderExistsCalls++
          // Simulate a slow Drive root probe that would freeze if awaited in loadLibrary.
          await new Promise((r) => setTimeout(r, probeDelayMs))
          return false
        },
        discoverVideoFiles: async () => []
      }
    })

    const loadStart = performance.now()
    const loaded = await manager.loadLibrary()
    const loadWallMs = performance.now() - loadStart

    expect(loaded.movies).toEqual([cached])
    // Background scan may *start* folderExists, but loadLibrary must not await it.
    expect(loaded.status.unavailableFolders).toEqual([])
    expect(loadWallMs).toBeLessThan(probeDelayMs)
    // Progress for unavailable not yet emitted (probe still in flight).
    expect(progress.some((p) => p.unavailable)).toBe(false)

    await manager.idle()
    expect(folderExistsCalls).toBeGreaterThanOrEqual(1)
    expect(progress).toContainEqual({
      folder: missingFolder,
      discovered: 0,
      ingested: 0,
      done: true,
      unavailable: true
    })
    // Cached titles remain; startup never marks missing.
    expect(manager.getMovies()).toEqual([cached])
  })

  it('startup background ingest prefers cache; rescanFolder does not (REQ-039)', async () => {
    const { mkdirSync } = await import('node:fs')
    const moviesDir = join(dir, 'movies')
    mkdirSync(moviesDir, { recursive: true })
    const file = join(moviesDir, 'Arrival.2016.mkv')
    const file2 = join(moviesDir, 'Dune.2021.mkv')
    writeFileSync(file, 'x')
    writeFileSync(file2, 'x')
    const settings = createSettingsStore(join(dir, 'settings.json'))
    settings.addFolder(moviesDir)
    const ingestOpts: Array<{ path: string; preferCache?: boolean }> = []
    let discoverPass = 0
    const manager = createLibraryManager({
      settings,
      makeClient: () => fakeClient,
      emit: () => {},
      appDataPath: join(dir, 'app-data'),
      scanDeps: {
        discoverVideoFiles: async () => {
          discoverPass++
          // Startup only sees one file; rescan discovers a second so ingest runs again.
          return discoverPass === 1 ? [file] : [file, file2]
        },
        ingestFile: async (path, folder, opts) => {
          ingestOpts.push({ path, preferCache: opts?.preferCache })
          return makeMovie({
            id: movieId(path),
            filePath: path,
            folderPath: folder,
            matchStatus: 'pending',
            tmdbId: null,
            title: null
          })
        }
      }
    })

    await manager.loadLibrary()
    await manager.idle()
    const startupIngest = ingestOpts.find((o) => o.path === file)
    expect(startupIngest?.preferCache).toBe(true)

    const beforeRescan = ingestOpts.length
    await manager.rescanFolder(moviesDir)
    const rescanIngest = ingestOpts.slice(beforeRescan).find((o) => o.path === file2)
    expect(rescanIngest).toBeDefined()
    expect(rescanIngest?.preferCache).not.toBe(true)
  })

  it('rescanFolder still marks vanished files missing while startup does not (REQ-039)', async () => {
    const { mkdirSync } = await import('node:fs')
    const moviesDir = join(dir, 'movies')
    mkdirSync(moviesDir, { recursive: true })
    const file = join(moviesDir, 'Gone.mkv')
    writeFileSync(file, 'x')
    const appDataPath = join(dir, 'app-data')
    const cached = makeMovie({
      filePath: file,
      folderPath: moviesDir,
      id: movieId(file),
      fileMissing: false
    })
    await createLibraryCache(appDataPath).write([cached])
    const settings = createSettingsStore(join(dir, 'settings.json'))
    settings.addFolder(moviesDir)
    const updates: MovieRecord[] = []
    const manager = createLibraryManager({
      settings,
      makeClient: () => fakeClient,
      emit: (channel, payload) => {
        if (channel === 'movie:updated') updates.push(payload as MovieRecord)
      },
      appDataPath,
      scanDeps: {
        // Simulate folder walk that no longer sees the file (Drive offline / deleted).
        discoverVideoFiles: async () => [],
        ingestFile: async (path, folder) => makeMovie({ filePath: path, folderPath: folder })
      }
    })

    await manager.loadLibrary()
    await manager.idle()
    expect(manager.getMovies()[0].fileMissing).toBe(false)
    expect(updates.some((m) => m.fileMissing)).toBe(false)

    await manager.rescanFolder(moviesDir)
    expect(manager.getMovies()[0].fileMissing).toBe(true)
    expect(updates.some((m) => m.fileMissing)).toBe(true)
  })

  it('hydrate fills cachedPosterPath from app-owned sidecar when JSON only has Drive posterPath (REQ-040)', async () => {
    // Simulate Google Drive library folder + cloud-only poster path stored in cache JSON,
    // while the poster was previously mirrored under userData cache/sidecars.
    const driveRoot = join(dir, 'GoogleDrive', 'My Drive', 'Movies')
    mkdirSync(driveRoot, { recursive: true })
    const filePath = join(driveRoot, 'Cached.Movie.2020.mkv')
    const drivePoster = join(driveRoot, 'Cached.Movie.2020-poster.jpg')
    const driveFanart = join(driveRoot, 'Cached.Movie.2020-fanart.jpg')
    // Drive art is cloud-only: not present on local disk.
    const appDataPath = join(dir, 'app-data')
    const sidecar = cachedSidecarPathsFor(filePath, appDataPath)
    mkdirSync(dirname(sidecar.poster), { recursive: true })
    writeFileSync(sidecar.poster, 'poster-bytes')
    writeFileSync(sidecar.fanart, 'fanart-bytes')

    const partial = makeMovie({
      filePath,
      folderPath: driveRoot,
      id: movieId(filePath),
      posterPath: drivePoster,
      fanartPath: driveFanart,
      cachedPosterPath: null,
      cachedFanartPath: null
    })
    await createLibraryCache(appDataPath).write([partial])

    const settings = createSettingsStore(join(dir, 'settings.json'))
    settings.addFolder(driveRoot)
    // Drive art is absent — if hydrate probed posterPath/fanartPath it would not help,
    // and filling still must succeed from app-owned sidecars only.
    expect(existsSync(drivePoster)).toBe(false)
    expect(existsSync(driveFanart)).toBe(false)
    expect(existsSync(sidecar.poster)).toBe(true)
    expect(existsSync(sidecar.fanart)).toBe(true)

    const manager = createLibraryManager({
      settings,
      makeClient: () => fakeClient,
      emit: () => {},
      appDataPath,
      scanDeps: {
        // Keep startup scan inert so load result is pure hydrate.
        folderExists: async () => false,
        discoverVideoFiles: async () => []
      }
    })

    const loaded = await manager.loadLibrary()
    const movie = loaded.movies[0]

    expect(movie.cachedPosterPath).toBe(sidecar.poster)
    expect(movie.cachedFanartPath).toBe(sidecar.fanart)
    expect(movie.cachedPosterPath!.startsWith(appDataPath)).toBe(true)
    const relPoster = relative(appDataPath, movie.cachedPosterPath!)
    expect(relPoster === '' || relPoster.startsWith('..')).toBe(false)
    // Drive source paths must remain as stored in JSON.
    expect(movie.posterPath).toBe(drivePoster)
    expect(movie.fanartPath).toBe(driveFanart)
  })

  it('hydrate persists completed cached art so next cache read has non-null paths (REQ-045)', async () => {
    const driveRoot = join(dir, 'GoogleDrive', 'My Drive', 'Movies')
    mkdirSync(driveRoot, { recursive: true })
    const filePath = join(driveRoot, 'Persist.Movie.2021.mkv')
    const drivePoster = join(driveRoot, 'Persist.Movie.2021-poster.jpg')
    const driveFanart = join(driveRoot, 'Persist.Movie.2021-fanart.jpg')
    const appDataPath = join(dir, 'app-data')
    const sidecar = cachedSidecarPathsFor(filePath, appDataPath)
    mkdirSync(dirname(sidecar.poster), { recursive: true })
    writeFileSync(sidecar.poster, 'poster-bytes')
    writeFileSync(sidecar.fanart, 'fanart-bytes')

    const partial = makeMovie({
      filePath,
      folderPath: driveRoot,
      id: movieId(filePath),
      posterPath: drivePoster,
      fanartPath: driveFanart,
      cachedPosterPath: null,
      cachedFanartPath: null
    })
    const libraryCache = createLibraryCache(appDataPath)
    await libraryCache.write([partial])

    // Precondition: on-disk JSON still has null cached fields.
    const before = await libraryCache.read()
    expect(before[0].cachedPosterPath).toBeNull()
    expect(before[0].cachedFanartPath).toBeNull()
    expect(existsSync(drivePoster)).toBe(false)
    expect(existsSync(driveFanart)).toBe(false)

    const settings = createSettingsStore(join(dir, 'settings.json'))
    settings.addFolder(driveRoot)
    const manager = createLibraryManager({
      settings,
      makeClient: () => fakeClient,
      emit: () => {},
      appDataPath,
      scanDeps: {
        folderExists: async () => false,
        discoverVideoFiles: async () => []
      }
    })

    const loaded = await manager.loadLibrary()
    expect(loaded.movies[0].cachedPosterPath).toBe(sidecar.poster)
    expect(loaded.movies[0].cachedFanartPath).toBe(sidecar.fanart)

    // After hydrate completion, cache JSON must be written so next launch is a no-op.
    const after = await libraryCache.read()
    expect(after).toHaveLength(1)
    expect(after[0].cachedPosterPath).toBe(sidecar.poster)
    expect(after[0].cachedFanartPath).toBe(sidecar.fanart)
    expect(after[0].posterPath).toBe(drivePoster)
    expect(after[0].fanartPath).toBe(driveFanart)
  })

  it('startup backfills missing cache art from Drive source without blocking loadLibrary (REQ-046)', async () => {
    const moviesDir = join(dir, 'movies')
    mkdirSync(moviesDir, { recursive: true })
    const filePath = join(moviesDir, 'Backfill.Movie.2019.mkv')
    const drivePoster = join(moviesDir, 'Backfill.Movie.2019-poster.jpg')
    writeFileSync(filePath, 'video-bytes')
    writeFileSync(drivePoster, 'poster-bytes')

    const appDataPath = join(dir, 'app-data')
    const partial = makeMovie({
      filePath,
      folderPath: moviesDir,
      id: movieId(filePath),
      posterPath: drivePoster,
      fanartPath: null,
      cachedPosterPath: null,
      cachedFanartPath: null,
      matchStatus: 'matched'
    })
    await createLibraryCache(appDataPath).write([partial])

    // Gate discover so loadLibrary returns before scan/backfill can run.
    const { promise, resolve } = deferred<string[]>()
    const settings = createSettingsStore(join(dir, 'settings.json'))
    settings.addFolder(moviesDir)
    const manager = createLibraryManager({
      settings,
      makeClient: () => fakeClient,
      emit: () => {},
      appDataPath,
      scanDeps: {
        discoverVideoFiles: () => promise
      }
    })

    const loaded = await manager.loadLibrary()
    expect(loaded.movies).toHaveLength(1)
    expect(loaded.movies[0].cachedPosterPath ?? null).toBeNull()
    expect(loaded.status.firstViewFromCache).toBe(true)
    // Cache file must not exist yet — hydrate only fills from existing app-owned sidecars.
    expect(existsSync(cachedSidecarPathsFor(filePath, appDataPath).poster)).toBe(false)

    resolve([filePath])
    await manager.idle()

    const movie = manager.getMovies()[0]
    expect(movie.cachedPosterPath).toBeTruthy()
    expect(movie.cachedPosterPath!.startsWith(appDataPath)).toBe(true)
    expect(existsSync(movie.cachedPosterPath!)).toBe(true)
    const relPoster = relative(appDataPath, movie.cachedPosterPath!)
    expect(relPoster === '' || relPoster.startsWith('..')).toBe(false)
    // Persist so next launch is a no-op for this field.
    const persisted = await createLibraryCache(appDataPath).read()
    expect(persisted[0].cachedPosterPath).toBe(movie.cachedPosterPath)
  })

  it('startup cache-art backfill failure leaves fields null and does not reject idle (REQ-046)', async () => {
    const moviesDir = join(dir, 'movies')
    mkdirSync(moviesDir, { recursive: true })
    const filePath = join(moviesDir, 'NoSource.Art.2018.mkv')
    writeFileSync(filePath, 'video-bytes')
    // No source poster/fanart on disk.

    const appDataPath = join(dir, 'app-data')
    const partial = makeMovie({
      filePath,
      folderPath: moviesDir,
      id: movieId(filePath),
      posterPath: join(moviesDir, 'NoSource.Art.2018-poster.jpg'),
      fanartPath: null,
      cachedPosterPath: null,
      cachedFanartPath: null
    })
    await createLibraryCache(appDataPath).write([partial])

    const settings = createSettingsStore(join(dir, 'settings.json'))
    settings.addFolder(moviesDir)
    const manager = createLibraryManager({
      settings,
      makeClient: () => fakeClient,
      emit: () => {},
      appDataPath,
      scanDeps: {
        discoverVideoFiles: async () => [filePath]
      }
    })

    await expect(manager.loadLibrary()).resolves.toMatchObject({
      movies: [expect.objectContaining({ id: partial.id })]
    })
    await expect(manager.idle()).resolves.toBeUndefined()
    expect(manager.getMovies()[0].cachedPosterPath ?? null).toBeNull()
  })
})

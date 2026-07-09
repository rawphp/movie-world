import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLibraryManager, type LibraryManager } from '../manager'
import { createSettingsStore } from '../../settings'
import { movieId } from '../scanner'
import { createLibraryCache } from '../cache'
import type { MovieRecord, ScanProgress } from '../../../shared/types'
import type { TmdbClient } from '../../tmdb/client'

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

    const manager = createLibraryManager({
      settings: createSettingsStore(join(dir, 'settings.json')),
      makeClient: () => fakeClient,
      emit: () => {},
      appDataPath,
      scanDeps: {
        discoverVideoFiles: () => promise,
        ingestFile: async (file, folder) => makeMovie({ filePath: file, folderPath: folder })
      }
    })
    const loaded = await manager.loadLibrary()

    expect(loaded).toEqual([cached])
    resolve([])
    await manager.idle()
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

    await expect(manager.loadLibrary()).resolves.toEqual([])
    expect(updates).toHaveLength(0)

    discovered.resolve([file])
    await manager.idle()

    expect(updates.some((m) => m.filePath === file)).toBe(true)
    expect(progress.at(-1)).toMatchObject({ folder: moviesDir, discovered: 1, ingested: 1, done: true })
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

    expect(loaded).toEqual([cached])
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
    expect(initial).toEqual([])
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
})

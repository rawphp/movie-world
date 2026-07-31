import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import {
  completeCachedArtworkPaths,
  createLibraryCache,
  libraryCachePath
} from '../cache'
import { cachedSidecarPathsFor } from '../nfo'
import type { MovieRecord } from '../../../shared/types'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mw-cache-'))
  return () => rmSync(root, { recursive: true, force: true })
})

function makeMovie(overrides: Partial<MovieRecord> = {}): MovieRecord {
  return {
    id: 'movie-1',
    filePath: join(root, 'movies', 'The Matrix (1999)', 'The Matrix.mkv'),
    fileSize: 123456,
    folderPath: join(root, 'movies'),
    parsedTitle: 'The Matrix',
    parsedYear: 1999,
    matchStatus: 'matched',
    tmdbId: 603,
    title: 'The Matrix',
    originalTitle: 'The Matrix',
    year: 1999,
    overview: 'A hacker discovers reality is not what it seems.',
    runtime: 136,
    voteAverage: 8.2,
    genres: ['Action', 'Science Fiction'],
    cast: [
      { name: 'Keanu Reeves', order: 0 },
      { name: 'Carrie-Anne Moss', order: 1 }
    ],
    certifications: { AU: 'M', US: 'R' },
    certificationAu: 'M',
    trailerYoutubeKey: 'vKQi3bBA1y8',
    playCount: 7,
    lastPlayedAt: '2026-07-09T12:34:56.000Z',
    fileMissing: false,
    sidecarWriteFailed: true,
    fetchFailed: false,
    posterPath: join(root, 'art-cache', 'poster.jpg'),
    fanartPath: join(root, 'art-cache', 'fanart.jpg'),
    ...overrides
  }
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith('/')
}

describe('library cache', () => {
  it('writes and reads records from app-owned cache storage outside a movie folder', async () => {
    const appData = join(root, 'app-data')
    const movieFolder = join(root, 'movies')
    const cache = createLibraryCache(appData)
    const records = [makeMovie()]

    await cache.write(records)

    expect(cache.filePath).toBe(join(appData, 'cache', 'library-records.json'))
    expect(cache.filePath).toBe(libraryCachePath(appData))
    expect(isInside(movieFolder, cache.filePath)).toBe(false)
    expect(existsSync(cache.filePath)).toBe(true)
    await expect(cache.read()).resolves.toEqual(records)
  })

  it('returns an empty list when the cache file is missing', async () => {
    const cache = createLibraryCache(join(root, 'app-data'))

    await expect(cache.read()).resolves.toEqual([])
  })

  it('returns an empty list when the cache file contains corrupt JSON', async () => {
    const appData = join(root, 'app-data')
    const cacheFile = libraryCachePath(appData)
    mkdirSync(join(appData, 'cache'), { recursive: true })
    writeFileSync(cacheFile, '{not valid json', 'utf8')

    await expect(createLibraryCache(appData).read()).resolves.toEqual([])
  })

  it('preserves file paths, metadata, match status, play state, and artwork paths', async () => {
    const records: MovieRecord[] = [
      makeMovie(),
      makeMovie({
        id: 'movie-2',
        filePath: join(root, 'movies', 'Alien.mkv'),
        folderPath: join(root, 'movies'),
        parsedTitle: 'Alien',
        parsedYear: 1979,
        matchStatus: 'unmatched',
        tmdbId: null,
        title: null,
        originalTitle: null,
        year: null,
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
        fileMissing: true,
        sidecarWriteFailed: false,
        fetchFailed: true,
        posterPath: null,
        fanartPath: null
      })
    ]
    const cache = createLibraryCache(join(root, 'app-data'))

    await cache.write(records)

    expect(await cache.read()).toEqual(records)
  })

  it('completeCachedArtworkPaths fills app-owned paths without probing Drive sources (REQ-040)', () => {
    const appData = join(root, 'app-data')
    const driveRoot = join(root, 'GoogleDrive', 'Movies')
    const filePath = join(driveRoot, 'Alien.mkv')
    const drivePoster = join(driveRoot, 'Alien-poster.jpg')
    const driveFanart = join(driveRoot, 'Alien-fanart.jpg')
    const sidecar = cachedSidecarPathsFor(filePath, appData)
    mkdirSync(dirname(sidecar.poster), { recursive: true })
    writeFileSync(sidecar.poster, 'p')
    // fanart missing on disk → stays null

    const record = makeMovie({
      filePath,
      folderPath: driveRoot,
      posterPath: drivePoster,
      fanartPath: driveFanart,
      cachedPosterPath: null,
      cachedFanartPath: null
    })

    const probed: string[] = []
    const completed = completeCachedArtworkPaths(record, appData, (p) => {
      probed.push(p)
      return existsSync(p)
    })

    expect(completed.cachedPosterPath).toBe(sidecar.poster)
    expect(completed.cachedFanartPath == null).toBe(true)
    expect(completed.posterPath).toBe(drivePoster)
    expect(probed).toContain(sidecar.poster)
    expect(probed).toContain(sidecar.fanart)
    expect(probed).not.toContain(drivePoster)
    expect(probed).not.toContain(driveFanart)
    expect(probed.every((p) => p.startsWith(appData))).toBe(true)
  })
})

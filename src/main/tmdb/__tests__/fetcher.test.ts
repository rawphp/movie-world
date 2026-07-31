import { afterEach, describe, expect, it, vi } from 'vitest'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createFetchQueue, fetchAndApply } from '../fetcher'
import type { TmdbClient } from '../client'
import type { MovieRecord } from '../../../shared/types'
import { cachedSidecarPathsFor, sidecarPathsFor } from '../../library/nfo'

const pendingMovie = (dir: string, name: string): MovieRecord => ({
  id: name,
  filePath: join(dir, `${name}.mkv`),
  fileSize: 0,
  folderPath: dir,
  parsedTitle: name,
  parsedYear: 1999,
  matchStatus: 'pending',
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
  fileMissing: false,
  sidecarWriteFailed: false,
  fetchFailed: false,
  posterPath: null,
  fanartPath: null
})

const details = {
  id: 603,
  title: 'The Matrix',
  release_date: '1999-03-30',
  poster_path: '/p.jpg',
  backdrop_path: '/b.jpg'
}
const searchHit = [{ id: 603, title: 'The Matrix', release_date: '1999-03-30' }]

const dirs: string[] = []
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mw-fetch-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true })
})

describe('fetch queue', () => {
  it('matches confidently, writes sidecars, emits matched record', async () => {
    const dir = tempDir()
    const client = {
      searchMovies: vi.fn(async () => searchHit),
      getMovieDetails: vi.fn(async () => details)
    } as unknown as TmdbClient
    const downloadImage = vi.fn(async () => {})
    const updates: MovieRecord[] = []
    const q = createFetchQueue({ client, onUpdate: (m) => updates.push(m), downloadImage })
    q.enqueue(pendingMovie(dir, 'The Matrix'))
    await q.idle()
    const last = updates.at(-1)!
    expect(last.matchStatus).toBe('matched')
    expect(last.tmdbId).toBe(603)
    expect(last.posterPath).toBe(join(dir, 'The Matrix-poster.jpg'))
    expect(last.fanartPath).toBe(join(dir, 'The Matrix-fanart.jpg'))
    expect(last.sidecarWriteFailed).toBe(false)
    expect(downloadImage).toHaveBeenCalledTimes(2) // poster + fanart
  })

  it('emits unmatched when no confident match', async () => {
    const dir = tempDir()
    const client = {
      searchMovies: vi.fn(async () => []),
      getMovieDetails: vi.fn()
    } as unknown as TmdbClient
    const updates: MovieRecord[] = []
    const q = createFetchQueue({
      client,
      onUpdate: (m) => updates.push(m),
      downloadImage: async () => {}
    })
    q.enqueue(pendingMovie(dir, 'Unknown Film'))
    await q.idle()
    expect(updates.at(-1)!.matchStatus).toBe('unmatched')
  })

  it('retries on failure then flags fetchFailed', async () => {
    const dir = tempDir()
    const searchMovies = vi.fn(async () => {
      throw new Error('network down')
    })
    const client = { searchMovies, getMovieDetails: vi.fn() } as unknown as TmdbClient
    const updates: MovieRecord[] = []
    const q = createFetchQueue({
      client,
      onUpdate: (m) => updates.push(m),
      downloadImage: async () => {},
      retries: 3,
      backoffMs: 1
    })
    q.enqueue(pendingMovie(dir, 'Flaky'))
    await q.idle()
    expect(searchMovies).toHaveBeenCalledTimes(3)
    expect(updates.at(-1)!.fetchFailed).toBe(true)
    expect(updates.at(-1)!.matchStatus).toBe('pending')
  })

  it('never runs more than `concurrency` fetches at once', async () => {
    const dir = tempDir()
    let active = 0
    let peak = 0
    const client = {
      searchMovies: vi.fn(async () => {
        active++
        peak = Math.max(peak, active)
        await new Promise((r) => setTimeout(r, 5))
        active--
        return []
      }),
      getMovieDetails: vi.fn()
    } as unknown as TmdbClient
    const q = createFetchQueue({
      client,
      onUpdate: () => {},
      downloadImage: async () => {},
      concurrency: 2
    })
    for (let i = 0; i < 6; i++) q.enqueue(pendingMovie(dir, `M${i}`))
    await q.idle()
    expect(peak).toBeLessThanOrEqual(2)
  })

  it('partial-write guard: an image download failure never reports matched-with-poster', async () => {
    const dir = tempDir()
    const client = {
      searchMovies: vi.fn(async () => searchHit),
      getMovieDetails: vi.fn(async () => details)
    } as unknown as TmdbClient
    const downloadImage = vi.fn(async () => {
      throw new Error('image download failed')
    })
    const updates: MovieRecord[] = []
    const q = createFetchQueue({
      client,
      onUpdate: (m) => updates.push(m),
      downloadImage,
      retries: 1,
      backoffMs: 1
    })
    q.enqueue(pendingMovie(dir, 'The Matrix'))
    await q.idle()
    const last = updates.at(-1)!
    // Never claim a clean matched record with a broken/absent poster.
    expect(last.posterPath).toBeNull()
    expect(last.matchStatus).not.toBe('matched')
    expect(last.fetchFailed).toBe(true)
  })
})

describe('fetchAndApply cache materialize (REQ-044)', () => {
  const matrixClient = (): TmdbClient =>
    ({
      searchMovies: vi.fn(async () => searchHit),
      getMovieDetails: vi.fn(async () => details)
    }) as unknown as TmdbClient

  it('downloads poster/fanart under userData cache and sets cachedPosterPath/cachedFanartPath', async () => {
    const dir = tempDir()
    const appData = join(dir, 'app-data')
    const movie = pendingMovie(dir, 'The Matrix')
    const cached = cachedSidecarPathsFor(movie.filePath, appData)
    const downloadImage = vi.fn(async (_url: string, dest: string) => {
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, dest.endsWith('poster.jpg') || dest.includes('poster') ? 'poster-bytes' : 'fanart-bytes')
    })

    const result = await fetchAndApply(movie, matrixClient(), downloadImage, undefined, appData)

    expect(result.matchStatus).toBe('matched')
    expect(result.cachedPosterPath).toBe(cached.poster)
    expect(result.cachedFanartPath).toBe(cached.fanart)
    expect(result.cachedPosterPath!.startsWith(appData)).toBe(true)
    expect(result.cachedFanartPath!.startsWith(appData)).toBe(true)
    expect(existsSync(cached.poster)).toBe(true)
    expect(existsSync(cached.fanart)).toBe(true)
    // Primary download targets are cache paths (Drive optional after).
    expect(downloadImage.mock.calls.some((c) => c[1] === cached.poster)).toBe(true)
    expect(downloadImage.mock.calls.some((c) => c[1] === cached.fanart)).toBe(true)
  })

  it('sets cache fields without requiring Drive paths for display (Drive write best-effort)', async () => {
    const dir = tempDir()
    const appData = join(dir, 'app-data')
    // Put the movie under a non-writable parent so Drive sidecar writes fail.
    const driveRoot = join(dir, 'drive-ro')
    mkdirSync(driveRoot, { recursive: true })
    const movieDir = join(driveRoot, 'The Matrix')
    mkdirSync(movieDir, { recursive: true })
    const movie = pendingMovie(movieDir, 'The Matrix')
    chmodSync(movieDir, 0o555)

    const cached = cachedSidecarPathsFor(movie.filePath, appData)
    const downloadImage = vi.fn(async (_url: string, dest: string) => {
      // Only allow writes under appData (cache); Drive dest will fail on writeFileSync.
      if (!dest.startsWith(appData)) {
        throw new Error('Drive write denied')
      }
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, 'ok')
    })

    let result: MovieRecord
    try {
      result = await fetchAndApply(movie, matrixClient(), downloadImage, undefined, appData)
    } finally {
      chmodSync(movieDir, 0o755)
    }

    expect(result.matchStatus).toBe('matched')
    expect(result.cachedPosterPath).toBe(cached.poster)
    expect(result.cachedFanartPath).toBe(cached.fanart)
    expect(existsSync(cached.poster)).toBe(true)
    // Drive art write failure must not clear cache fields or unmatch.
    expect(result.cachedPosterPath).not.toBeNull()
    expect(result.cachedFanartPath).not.toBeNull()
  })

  it('does not set non-null cache fields when cache download fails', async () => {
    const dir = tempDir()
    const appData = join(dir, 'app-data')
    const movie = pendingMovie(dir, 'The Matrix')
    const downloadImage = vi.fn(async () => {
      throw new Error('cache download failed')
    })

    await expect(
      fetchAndApply(movie, matrixClient(), downloadImage, undefined, appData)
    ).rejects.toThrow('cache download failed')
  })

  it('createFetchQueue passes appDataPath so matched records get cache art paths', async () => {
    const dir = tempDir()
    const appData = join(dir, 'app-data')
    const movie = pendingMovie(dir, 'The Matrix')
    const cached = cachedSidecarPathsFor(movie.filePath, appData)
    const downloadImage = vi.fn(async (_url: string, dest: string) => {
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, 'img')
    })
    const updates: MovieRecord[] = []
    const q = createFetchQueue({
      client: matrixClient(),
      onUpdate: (m) => updates.push(m),
      downloadImage,
      appDataPath: appData
    })
    q.enqueue(movie)
    await q.idle()
    const last = updates.at(-1)!
    expect(last.matchStatus).toBe('matched')
    expect(last.cachedPosterPath).toBe(cached.poster)
    expect(last.cachedFanartPath).toBe(cached.fanart)
  })

  it('without appDataPath keeps legacy Drive-only poster paths (no cache fields)', async () => {
    const dir = tempDir()
    const movie = pendingMovie(dir, 'The Matrix')
    const downloadImage = vi.fn(async () => {})
    const result = await fetchAndApply(movie, matrixClient(), downloadImage)
    expect(result.posterPath).toBe(sidecarPathsFor(movie.filePath).poster)
    expect(result.fanartPath).toBe(sidecarPathsFor(movie.filePath).fanart)
    expect(result.cachedPosterPath ?? null).toBeNull()
    expect(result.cachedFanartPath ?? null).toBeNull()
  })
})

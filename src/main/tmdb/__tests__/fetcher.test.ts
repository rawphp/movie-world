import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFetchQueue } from '../fetcher'
import type { TmdbClient } from '../client'
import type { MovieRecord } from '../../../shared/types'

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

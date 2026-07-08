import { writeFileSync } from 'node:fs'
import type { MovieRecord } from '../../shared/types'
import { sidecarPathsFor, writeSidecarNfo } from '../library/nfo'
import { imageUrl, type TmdbClient } from './client'
import { applyDetails, pickConfidentMatch } from './matcher'

export type DownloadImage = (url: string, dest: string) => Promise<void>

/** Fetch an image and write it to `dest`. Throws on a non-2xx response. */
export async function downloadImageToFile(
  url: string,
  dest: string,
  fetchFn: typeof fetch = fetch
): Promise<void> {
  const res = await fetchFn(url)
  if (!res.ok) throw new Error(`image download failed: ${res.status}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

/**
 * Single-movie pipeline, reused by the queue and by fix-match/retry.
 * Searches (unless `tmdbId` is supplied), applies details, downloads the
 * poster/fanart, then writes the NFO. Images are downloaded BEFORE the record
 * claims to own them and BEFORE the NFO is written, so a failed download
 * propagates (leaving `posterPath` null) rather than reporting a clean
 * `matched` record with a broken poster (UR-001 partial-write guard).
 */
export async function fetchAndApply(
  movie: MovieRecord,
  client: TmdbClient,
  downloadImage: DownloadImage,
  tmdbId?: number
): Promise<MovieRecord> {
  let id = tmdbId ?? null
  if (id == null) {
    const results = await client.searchMovies(movie.parsedTitle, movie.parsedYear)
    const hit = pickConfidentMatch({ title: movie.parsedTitle, year: movie.parsedYear }, results)
    if (!hit) return { ...movie, matchStatus: 'unmatched', fetchFailed: false }
    id = hit.id
  }
  const details = await client.getMovieDetails(id)
  let matched = applyDetails(movie, details)
  const paths = sidecarPathsFor(movie.filePath)
  if (details.poster_path) {
    await downloadImage(imageUrl(details.poster_path, 'w500'), paths.poster)
    matched = { ...matched, posterPath: paths.poster }
  }
  if (details.backdrop_path) {
    await downloadImage(imageUrl(details.backdrop_path, 'original'), paths.fanart)
    matched = { ...matched, fanartPath: paths.fanart }
  }
  try {
    writeSidecarNfo(matched)
  } catch {
    matched = { ...matched, sidecarWriteFailed: true }
  }
  return matched
}

export interface FetchQueue {
  enqueue(movie: MovieRecord): void
  idle(): Promise<void>
}

export function createFetchQueue(opts: {
  client: TmdbClient
  onUpdate: (m: MovieRecord) => void
  concurrency?: number
  retries?: number
  backoffMs?: number
  downloadImage?: DownloadImage
}): FetchQueue {
  const concurrency = opts.concurrency ?? 4
  const retries = opts.retries ?? 3
  const backoffMs = opts.backoffMs ?? 1000
  const downloadImage = opts.downloadImage ?? downloadImageToFile
  const waiting: MovieRecord[] = []
  let active = 0
  let idleResolvers: Array<() => void> = []

  async function run(movie: MovieRecord): Promise<void> {
    active++
    try {
      for (let attempt = 1; ; attempt++) {
        try {
          opts.onUpdate(await fetchAndApply(movie, opts.client, downloadImage))
          break
        } catch {
          if (attempt >= retries) {
            opts.onUpdate({ ...movie, fetchFailed: true })
            break
          }
          await new Promise((r) => setTimeout(r, backoffMs * 2 ** (attempt - 1)))
        }
      }
    } finally {
      active--
      pump()
    }
  }

  function pump(): void {
    while (active < concurrency && waiting.length) void run(waiting.shift()!)
    if (active === 0 && waiting.length === 0) {
      idleResolvers.forEach((r) => r())
      idleResolvers = []
    }
  }

  return {
    enqueue(movie: MovieRecord): void {
      waiting.push(movie)
      pump()
    },
    idle: () =>
      new Promise<void>((resolve) => {
        if (active === 0 && waiting.length === 0) resolve()
        else idleResolvers.push(resolve)
      })
  }
}

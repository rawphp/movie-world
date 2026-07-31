import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { MovieRecord } from '../../shared/types'
import {
  cachedSidecarPathsFor,
  movieToNfoXml,
  sidecarPathsFor,
  writeSidecarNfo
} from '../library/nfo'
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
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

/**
 * Materialize one artwork file. When `cacheDest` is set (appDataPath available),
 * cache is the primary write target — match/paint success requires it. Drive
 * (`driveDest`) is best-effort for Kodi/NFO compatibility and never clears a
 * successful cache path (REQ-044).
 */
async function materializeArt(
  url: string,
  driveDest: string,
  downloadImage: DownloadImage,
  cacheDest?: string
): Promise<{ path: string | null; cachedPath: string | null }> {
  if (cacheDest) {
    mkdirSync(dirname(cacheDest), { recursive: true })
    await downloadImage(url, cacheDest)
    // Cache succeeded — Drive is best-effort only.
    try {
      mkdirSync(dirname(driveDest), { recursive: true })
      if (existsSync(cacheDest)) {
        copyFileSync(cacheDest, driveDest)
      } else {
        await downloadImage(url, driveDest)
      }
      return { path: driveDest, cachedPath: cacheDest }
    } catch {
      return { path: cacheDest, cachedPath: cacheDest }
    }
  }
  // Legacy: no appDataPath — write Drive only.
  await downloadImage(url, driveDest)
  return { path: driveDest, cachedPath: null }
}

/**
 * Single-movie pipeline, reused by the queue and by fix-match/retry.
 * Searches (unless `tmdbId` is supplied), applies details, downloads the
 * poster/fanart, then writes the NFO. Images are downloaded BEFORE the record
 * claims to own them and BEFORE the NFO is written, so a failed download
 * propagates (leaving `posterPath` null) rather than reporting a clean
 * `matched` record with a broken poster (UR-001 partial-write guard).
 *
 * With `appDataPath`, poster/fanart (and NFO) materialize under
 * `cachedSidecarPathsFor` first; Drive sidecars remain best-effort for Kodi.
 */
export async function fetchAndApply(
  movie: MovieRecord,
  client: TmdbClient,
  downloadImage: DownloadImage,
  tmdbId?: number,
  appDataPath?: string
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
  const drivePaths = sidecarPathsFor(movie.filePath)
  const cachePaths = appDataPath ? cachedSidecarPathsFor(movie.filePath, appDataPath) : null

  if (details.poster_path) {
    const poster = await materializeArt(
      imageUrl(details.poster_path, 'w500'),
      drivePaths.poster,
      downloadImage,
      cachePaths?.poster
    )
    matched = {
      ...matched,
      posterPath: poster.path,
      cachedPosterPath: poster.cachedPath
    }
  }
  if (details.backdrop_path) {
    const fanart = await materializeArt(
      imageUrl(details.backdrop_path, 'original'),
      drivePaths.fanart,
      downloadImage,
      cachePaths?.fanart
    )
    matched = {
      ...matched,
      fanartPath: fanart.path,
      cachedFanartPath: fanart.cachedPath
    }
  }

  // NFO: cache first when available, then Drive (best-effort pair).
  try {
    if (cachePaths) {
      mkdirSync(dirname(cachePaths.nfo), { recursive: true })
      writeFileSync(cachePaths.nfo, movieToNfoXml(matched), 'utf8')
    }
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
  /** When set, matched art materializes under app-owned cache (REQ-044). */
  appDataPath?: string
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
          opts.onUpdate(
            await fetchAndApply(movie, opts.client, downloadImage, undefined, opts.appDataPath)
          )
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

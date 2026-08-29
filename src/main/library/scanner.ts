import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { access, copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import type { MovieRecord, ParsedFilename } from '../../shared/types'
import { parseFilename } from './filename-parser'
import { cachedSidecarPathsFor, readSidecarNfo, sidecarPathsFor } from './nfo'

export const VIDEO_EXTENSIONS = new Set(['.mkv', '.mp4', '.avi', '.mov', '.m4v', '.wmv', '.webm'])

/** Extras / samples that should lose to the main feature in a multi-file movie folder. */
const EXTRA_VIDEO_NAME =
  /(?:^|[\s._-])(sample|trailer|featurette|extra|deleted.?scene|bonus)(?:$|[\s._-])/i

export const movieId = (filePath: string): string =>
  createHash('sha1').update(filePath).digest('hex')

/**
 * When a movie lives in its own subfolder with multiple video files (main + sample,
 * cloud stub + full file, disc1/disc2, etc.), keep one primary file per folder.
 * Files directly under the library root are never collapsed (flat libraries).
 */
export async function selectPrimaryVideosPerFolder(
  files: string[],
  libraryRoot: string
): Promise<string[]> {
  const root = resolve(libraryRoot)
  const groups = new Map<string, string[]>()
  for (const file of files) {
    const parent = dirname(file)
    const list = groups.get(parent) ?? []
    list.push(file)
    groups.set(parent, list)
  }

  const selected: string[] = []
  for (const [parent, group] of groups) {
    if (group.length === 1 || resolve(parent) === root) {
      selected.push(...group)
      continue
    }
    selected.push(await pickPrimaryVideo(group))
  }
  return selected.sort()
}

async function pickPrimaryVideo(files: string[]): Promise<string> {
  const ranked = await Promise.all(
    files.map(async (file) => {
      let size = 0
      try {
        size = (await stat(file)).size
      } catch {
        size = 0
      }
      const name = basename(file)
      return {
        file,
        size,
        zeroPenalty: size === 0 ? 1 : 0,
        extraPenalty: EXTRA_VIDEO_NAME.test(name) ? 1 : 0
      }
    })
  )

  ranked.sort((a, b) => {
    if (a.zeroPenalty !== b.zeroPenalty) return a.zeroPenalty - b.zeroPenalty
    if (a.extraPenalty !== b.extraPenalty) return a.extraPenalty - b.extraPenalty
    if (b.size !== a.size) return b.size - a.size
    return a.file.localeCompare(b.file)
  })

  return ranked[0]!.file
}

export async function discoverVideoFiles(root: string): Promise<string[]> {
  const found: string[] = []
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (VIDEO_EXTENSIONS.has(extname(entry.name).toLowerCase())) found.push(full)
    }
  }
  await walk(root)
  // One entry per movie folder when users keep each title in its own directory.
  return selectPrimaryVideosPerFolder(found, root)
}

// A year is the strongest match signal; a multi-word title is a weaker one.
const informativeness = (p: ParsedFilename): number =>
  (p.year !== null ? 2 : 0) + (p.title.includes(' ') ? 1 : 0)

// Parse the filename, falling back to the parent folder name (e.g. `The Matrix
// (1999)`) when the filename itself yields no usable title/year (UR-001).
function parseWithFolderFallback(filePath: string): ParsedFilename {
  const parsed = parseFilename(basename(filePath))
  if (parsed.year !== null) return parsed
  const fromFolder = parseFilename(basename(dirname(filePath)))
  return informativeness(fromFolder) > informativeness(parsed) ? fromFolder : parsed
}

/** Explicit library scan mode (REQ-048). Replaces preferCache = !markMissing. */
export type ScanMode = 'startup' | 'rescan'

export interface IngestOptions {
  appDataPath?: string
  /**
   * Explicit scan mode (REQ-048):
   * - `startup` — prefer app-owned cache; skip Drive sidecar probes when warm
   * - `rescan` — full source reconcile (NFO/art from movie folder)
   */
  mode?: ScanMode
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function mirrorArtwork(sourcePath: string, cachedPath: string): Promise<void> {
  try {
    await mkdir(dirname(cachedPath), { recursive: true })
    // fs.promises.copyFile runs on the libuv threadpool so a slow Drive
    // source cannot freeze the Electron main / UI thread.
    await copyFile(sourcePath, cachedPath)
  } catch {
    // Cache refresh is best-effort; source artwork remains the usable path.
  }
}

interface ResolvedArtworkPath {
  path: string | null
  cachedPath: string | null
}

/**
 * Resolve poster/fanart paths for a sidecar pair.
 *
 * Cache-first (REQ-038/039): when an app-owned cache file already exists, return
 * it as the usable path without exists/read/mirror on the source sidecar.
 * Probing Google Drive cloud-only source files with sync fs blocks the UI
 * thread; a warm cache must never require that probe for grid/detail paint
 * or startup scan. Source probes use fs.promises so Drive I/O yields.
 */
async function resolveArtworkPath(
  sourcePath: string,
  cachedPath?: string
): Promise<ResolvedArtworkPath> {
  if (cachedPath && (await pathExists(cachedPath))) {
    return { path: cachedPath, cachedPath }
  }
  if (await pathExists(sourcePath)) {
    if (cachedPath) await mirrorArtwork(sourcePath, cachedPath)
    return {
      path: sourcePath,
      cachedPath: cachedPath && (await pathExists(cachedPath)) ? cachedPath : null
    }
  }
  return { path: null, cachedPath: null }
}

async function isUsableCacheFile(path: string | null | undefined): Promise<boolean> {
  return path != null && path !== '' && (await pathExists(path))
}

/**
 * True when either app-owned cache art field is null/empty or its on-disk file is gone.
 * Startup scan uses this to schedule Drive→cache backfill without full re-ingest (REQ-046).
 */
export function needsCacheArtBackfill(
  movie: Pick<MovieRecord, 'cachedPosterPath' | 'cachedFanartPath'>,
  exists: (p: string) => boolean = existsSync
): boolean {
  const posterOk =
    movie.cachedPosterPath != null &&
    movie.cachedPosterPath !== '' &&
    exists(movie.cachedPosterPath)
  const fanartOk =
    movie.cachedFanartPath != null &&
    movie.cachedFanartPath !== '' &&
    exists(movie.cachedFanartPath)
  return !posterOk || !fanartOk
}

/**
 * Mirror missing app-owned cache poster/fanart from source/Drive sidecars.
 * Does not re-read NFO or reparse metadata — art-only heal for incomplete cache (REQ-046).
 * Failed or missing source leaves the corresponding cache field null.
 * Drive exists/copy run via fs.promises so rclone FUSE cannot stall the UI.
 */
export async function backfillCacheArtFromSource(
  movie: MovieRecord,
  appDataPath: string
): Promise<MovieRecord> {
  const source = sidecarPathsFor(movie.filePath)
  const cached = cachedSidecarPathsFor(movie.filePath, appDataPath)

  let cachedPosterPath: string | null = (await isUsableCacheFile(movie.cachedPosterPath))
    ? movie.cachedPosterPath!
    : null
  let cachedFanartPath: string | null = (await isUsableCacheFile(movie.cachedFanartPath))
    ? movie.cachedFanartPath!
    : null

  if (cachedPosterPath == null) {
    if (await pathExists(cached.poster)) {
      cachedPosterPath = cached.poster
    } else if (await pathExists(source.poster)) {
      await mirrorArtwork(source.poster, cached.poster)
      cachedPosterPath = (await pathExists(cached.poster)) ? cached.poster : null
    }
  }

  if (cachedFanartPath == null) {
    if (await pathExists(cached.fanart)) {
      cachedFanartPath = cached.fanart
    } else if (await pathExists(source.fanart)) {
      await mirrorArtwork(source.fanart, cached.fanart)
      cachedFanartPath = (await pathExists(cached.fanart)) ? cached.fanart : null
    }
  }

  if (
    cachedPosterPath === (movie.cachedPosterPath ?? null) &&
    cachedFanartPath === (movie.cachedFanartPath ?? null)
  ) {
    return movie
  }
  return { ...movie, cachedPosterPath, cachedFanartPath }
}

export async function ingestFile(
  filePath: string,
  folderPath: string,
  opts: IngestOptions = {}
): Promise<MovieRecord> {
  const { size } = await stat(filePath)
  const parsed = parseWithFolderFallback(filePath)
  const base: MovieRecord = {
    id: movieId(filePath),
    filePath,
    fileSize: size,
    folderPath,
    parsedTitle: parsed.title,
    parsedYear: parsed.year,
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
  }
  const nfo = await readSidecarNfo(filePath, opts.appDataPath, { mode: opts.mode })
  if (!nfo) return base
  const paths = sidecarPathsFor(filePath)
  const cachedPaths = opts.appDataPath ? cachedSidecarPathsFor(filePath, opts.appDataPath) : null
  const poster = await resolveArtworkPath(paths.poster, cachedPaths?.poster)
  const fanart = await resolveArtworkPath(paths.fanart, cachedPaths?.fanart)
  return {
    ...base,
    ...nfo,
    matchStatus: 'matched',
    posterPath: poster.path,
    fanartPath: fanart.path,
    cachedPosterPath: poster.cachedPath,
    cachedFanartPath: fanart.cachedPath
  }
}

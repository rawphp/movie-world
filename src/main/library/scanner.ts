import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import type { MovieRecord, ParsedFilename } from '../../shared/types'
import { parseFilename } from './filename-parser'
import { cachedSidecarPathsFor, readSidecarNfo, sidecarPathsFor } from './nfo'

export const VIDEO_EXTENSIONS = new Set(['.mkv', '.mp4', '.avi', '.mov', '.m4v', '.wmv', '.webm'])

export const movieId = (filePath: string): string =>
  createHash('sha1').update(filePath).digest('hex')

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
  return found.sort()
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

export interface IngestOptions {
  appDataPath?: string
}

function mirrorArtwork(sourcePath: string, cachedPath: string): void {
  try {
    mkdirSync(dirname(cachedPath), { recursive: true })
    copyFileSync(sourcePath, cachedPath)
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
 * Cache-first (REQ-038): when an app-owned cache file already exists, return it
 * as the usable path without existsSync/read/mirror on the source sidecar.
 * Probing Google Drive cloud-only source files blocks the main process; a warm
 * cache must never require that probe for grid/detail paint.
 */
function resolveArtworkPath(sourcePath: string, cachedPath?: string): ResolvedArtworkPath {
  if (cachedPath && existsSync(cachedPath)) {
    return { path: cachedPath, cachedPath }
  }
  if (existsSync(sourcePath)) {
    if (cachedPath) mirrorArtwork(sourcePath, cachedPath)
    return {
      path: sourcePath,
      cachedPath: cachedPath && existsSync(cachedPath) ? cachedPath : null
    }
  }
  return { path: null, cachedPath: null }
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
  const nfo = readSidecarNfo(filePath, opts.appDataPath)
  if (!nfo) return base
  const paths = sidecarPathsFor(filePath)
  const cachedPaths = opts.appDataPath ? cachedSidecarPathsFor(filePath, opts.appDataPath) : null
  const poster = resolveArtworkPath(paths.poster, cachedPaths?.poster)
  const fanart = resolveArtworkPath(paths.fanart, cachedPaths?.fanart)
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

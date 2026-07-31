import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { MovieRecord } from '../../shared/types'
import { cachedSidecarPathsFor } from './nfo'

const CACHE_DIR = 'cache'
const LIBRARY_CACHE_FILE = 'library-records.json'

export interface LibraryCache {
  filePath: string
  read(): Promise<MovieRecord[]>
  write(records: MovieRecord[]): Promise<void>
}

export function libraryCachePath(appDataPath: string): string {
  return join(appDataPath, CACHE_DIR, LIBRARY_CACHE_FILE)
}

/**
 * Fill `cachedPosterPath` / `cachedFanartPath` when app-owned sidecar files exist
 * under userData, even if library-records.json omitted those fields (REQ-040).
 *
 * Only probes paths under `appDataPath` (via `cachedSidecarPathsFor`). Never
 * existsSync/stat on Google Drive source poster/fanart paths.
 */
export function completeCachedArtworkPaths(
  record: MovieRecord,
  appDataPath: string,
  exists: (path: string) => boolean = existsSync
): MovieRecord {
  const sidecar = cachedSidecarPathsFor(record.filePath, appDataPath)
  let cachedPosterPath = record.cachedPosterPath ?? null
  let cachedFanartPath = record.cachedFanartPath ?? null
  let changed = false

  if (cachedPosterPath == null && exists(sidecar.poster)) {
    cachedPosterPath = sidecar.poster
    changed = true
  }
  if (cachedFanartPath == null && exists(sidecar.fanart)) {
    cachedFanartPath = sidecar.fanart
    changed = true
  }

  return changed ? { ...record, cachedPosterPath, cachedFanartPath } : record
}

export function createLibraryCache(appDataPath: string): LibraryCache {
  const filePath = libraryCachePath(appDataPath)

  return {
    filePath,
    async read(): Promise<MovieRecord[]> {
      try {
        const parsed = JSON.parse(await readFile(filePath, 'utf8'))
        return Array.isArray(parsed) ? (parsed as MovieRecord[]) : []
      } catch {
        return []
      }
    },
    async write(records: MovieRecord[]): Promise<void> {
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, JSON.stringify(records, null, 2), 'utf8')
    }
  }
}

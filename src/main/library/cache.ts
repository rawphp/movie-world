import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { MovieRecord } from '../../shared/types'

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

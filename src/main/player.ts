import { existsSync } from 'node:fs'
import type { MovieRecord } from '../shared/types'
import { writeSidecarNfo } from './library/nfo'

interface PlayDeps {
  openPath?: (p: string) => Promise<string>
  now?: () => Date
}

async function defaultOpenPath(p: string): Promise<string> {
  const { shell } = await import('electron')
  return shell.openPath(p)
}

export async function playMovie(movie: MovieRecord, deps: PlayDeps = {}): Promise<MovieRecord> {
  if (!existsSync(movie.filePath)) return { ...movie, fileMissing: true }
  await (deps.openPath ?? defaultOpenPath)(movie.filePath)
  let updated: MovieRecord = {
    ...movie,
    playCount: movie.playCount + 1,
    lastPlayedAt: (deps.now ?? ((): Date => new Date()))().toISOString()
  }
  try {
    writeSidecarNfo(updated)
  } catch {
    updated = { ...updated, sidecarWriteFailed: true }
  }
  return updated
}

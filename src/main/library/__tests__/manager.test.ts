import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLibraryManager, type LibraryManager } from '../manager'
import { createSettingsStore } from '../../settings'
import { movieId } from '../scanner'
import type { MovieRecord, ScanProgress } from '../../../shared/types'
import type { TmdbClient } from '../../tmdb/client'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mw-mgr-'))
  return () => rmSync(dir, { recursive: true, force: true })
})

const fakeClient = {
  searchMovies: vi.fn(async () => [{ id: 603, title: 'The Matrix', release_date: '1999-03-30' }]),
  getMovieDetails: vi.fn(async () => ({ id: 603, title: 'The Matrix', release_date: '1999-03-30' }))
} as unknown as TmdbClient

function makeManager(): {
  manager: LibraryManager
  settings: ReturnType<typeof createSettingsStore>
  updates: MovieRecord[]
  progress: ScanProgress[]
} {
  const settingsFile = join(dir, 'settings.json')
  const settings = createSettingsStore(settingsFile)
  settings.setApiKey('KEY')
  settings.addFolder(join(dir, 'movies'))
  const updates: MovieRecord[] = []
  const progress: ScanProgress[] = []
  const manager = createLibraryManager({
    settings,
    makeClient: () => fakeClient,
    emit: (channel, payload) => {
      if (channel === 'movie:updated') updates.push(payload as MovieRecord)
      else progress.push(payload as ScanProgress)
    },
    downloadImage: async () => {}
  })
  return { manager, settings, updates, progress }
}

describe('library manager', () => {
  it('loads, returns pending records immediately, then emits matched updates', async () => {
    const moviesDir = join(dir, 'movies')
    const { mkdirSync } = await import('node:fs')
    mkdirSync(moviesDir, { recursive: true })
    const file = join(moviesDir, 'The.Matrix.1999.mkv')
    writeFileSync(file, 'x')

    const { manager, updates } = makeManager()
    const initial = await manager.loadLibrary()
    expect(initial).toHaveLength(1)
    expect(initial[0].matchStatus).toBe('pending')
    await manager.idle()
    expect(updates.at(-1)!.matchStatus).toBe('matched')
    expect(manager.getMovies()[0].tmdbId).toBe(603)
  })

  it('rescan flags vanished files as missing', async () => {
    const { mkdirSync } = await import('node:fs')
    const moviesDir = join(dir, 'movies')
    mkdirSync(moviesDir, { recursive: true })
    const file = join(moviesDir, 'Alien.mkv')
    writeFileSync(file, 'x')
    const { manager, updates } = makeManager()
    await manager.loadLibrary()
    await manager.idle()
    unlinkSync(file)
    await manager.rescanFolder(moviesDir)
    const flagged = updates.find((m) => m.id === movieId(file) && m.fileMissing)
    expect(flagged).toBeDefined()
  })

  it('fixMatch fetches the supplied tmdb id and emits matched', async () => {
    const { mkdirSync } = await import('node:fs')
    const moviesDir = join(dir, 'movies')
    mkdirSync(moviesDir, { recursive: true })
    const file = join(moviesDir, 'Obscure Film.mkv')
    writeFileSync(file, 'x')
    const { manager, updates } = makeManager()
    await manager.loadLibrary()
    await manager.idle()
    await manager.fixMatch(movieId(file), 603)
    expect(updates.at(-1)!).toMatchObject({ tmdbId: 603, matchStatus: 'matched' })
  })
})

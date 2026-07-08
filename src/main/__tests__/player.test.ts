import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { playMovie } from '../player'
import { sidecarPathsFor } from '../library/nfo'
import type { MovieRecord } from '../../shared/types'

const record = (filePath: string): MovieRecord => ({
  id: 'x',
  filePath,
  fileSize: 1,
  folderPath: '/m',
  parsedTitle: 'Alien',
  parsedYear: 1979,
  matchStatus: 'matched',
  tmdbId: 348,
  title: 'Alien',
  originalTitle: 'Alien',
  year: 1979,
  overview: null,
  runtime: 117,
  voteAverage: 8.1,
  genres: ['Horror'],
  cast: [],
  certifications: { AU: 'M' },
  certificationAu: 'M',
  trailerYoutubeKey: null,
  playCount: 1,
  lastPlayedAt: null,
  fileMissing: false,
  sidecarWriteFailed: false,
  fetchFailed: false,
  posterPath: null,
  fanartPath: null
})

describe('playMovie', () => {
  it('launches, increments playcount, stamps lastPlayed, persists to NFO', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mw-play-'))
    const file = join(dir, 'Alien.mkv')
    writeFileSync(file, 'x')
    const openPath = vi.fn(async () => '')
    const now = (): Date => new Date('2026-07-08T09:00:00.000Z')
    const updated = await playMovie(record(file), { openPath, now })
    expect(openPath).toHaveBeenCalledWith(file)
    expect(updated.playCount).toBe(2)
    expect(updated.lastPlayedAt).toBe('2026-07-08T09:00:00.000Z')
    expect(readFileSync(sidecarPathsFor(file).nfo, 'utf8')).toContain('<playcount>2</playcount>')
    rmSync(dir, { recursive: true, force: true })
  })

  it('flags fileMissing and does not launch when the file is gone', async () => {
    const openPath = vi.fn(async () => '')
    const updated = await playMovie(record('/nowhere/Alien.mkv'), { openPath })
    expect(openPath).not.toHaveBeenCalled()
    expect(updated.fileMissing).toBe(true)
    expect(updated.playCount).toBe(1) // unchanged
  })
})

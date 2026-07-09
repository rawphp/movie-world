import { describe, it, expect } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  cachedSidecarPathsFor,
  movieToNfoXml,
  parseNfoXml,
  sidecarPathsFor,
  readSidecarNfo
} from '../nfo'
import type { MovieRecord } from '../../../shared/types'

const movie: MovieRecord = {
  id: 'abc',
  filePath: '/Movies/The Matrix (1999)/The Matrix (1999).mkv',
  fileSize: 1,
  folderPath: '/Movies',
  parsedTitle: 'The Matrix',
  parsedYear: 1999,
  matchStatus: 'matched',
  tmdbId: 603,
  title: 'The Matrix',
  originalTitle: 'The Matrix',
  year: 1999,
  overview: 'A hacker learns the truth. <Reality> & "choice".',
  runtime: 136,
  voteAverage: 8.2,
  genres: ['Action', 'Science Fiction'],
  cast: [
    { name: 'Keanu Reeves', order: 0 },
    { name: 'Laurence Fishburne', order: 1 }
  ],
  certifications: { AU: 'MA15+', US: 'R' },
  certificationAu: 'MA15+',
  trailerYoutubeKey: 'vKQi3bBA1y8',
  playCount: 2,
  lastPlayedAt: '2026-07-01T10:00:00.000Z',
  fileMissing: false,
  sidecarWriteFailed: false,
  fetchFailed: false,
  posterPath: null,
  fanartPath: null
}

describe('nfo', () => {
  it('maps sidecar paths from the movie file stem', () => {
    expect(sidecarPathsFor('/m/Alien.mkv')).toEqual({
      nfo: '/m/Alien.nfo',
      poster: '/m/Alien-poster.jpg',
      fanart: '/m/Alien-fanart.jpg'
    })
  })

  it('round-trips all metadata through Kodi XML', () => {
    const data = parseNfoXml(movieToNfoXml(movie))
    expect(data).toEqual({
      tmdbId: 603,
      title: 'The Matrix',
      originalTitle: 'The Matrix',
      year: 1999,
      overview: 'A hacker learns the truth. <Reality> & "choice".',
      runtime: 136,
      voteAverage: 8.2,
      genres: ['Action', 'Science Fiction'],
      cast: movie.cast,
      certifications: { AU: 'MA15+', US: 'R' },
      certificationAu: 'MA15+',
      trailerYoutubeKey: 'vKQi3bBA1y8',
      playCount: 2,
      lastPlayedAt: '2026-07-01T10:00:00.000Z'
    })
  })

  it('readSidecarNfo returns null when absent, data when present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mw-nfo-'))
    const file = join(dir, 'The Matrix (1999).mkv')
    expect(readSidecarNfo(file)).toBeNull()
    writeFileSync(sidecarPathsFor(file).nfo, movieToNfoXml(movie))
    expect(readSidecarNfo(file)?.tmdbId).toBe(603)
  })

  it('maps cached sidecar paths into app-owned cache storage', () => {
    const appData = join(tmpdir(), 'mw-app-data')
    const paths = cachedSidecarPathsFor('/Movies/Alien.mkv', appData)

    expect(paths.nfo.startsWith(join(appData, 'cache', 'sidecars'))).toBe(true)
    expect(paths.poster.startsWith(join(appData, 'cache', 'sidecars'))).toBe(true)
    expect(paths.fanart.startsWith(join(appData, 'cache', 'sidecars'))).toBe(true)
    expect(paths.nfo).not.toContain('/Movies')
    expect(cachedSidecarPathsFor('/Movies/Alien.mkv', appData)).toEqual(paths)
  })

  it('reads cached NFO when the source sidecar is absent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mw-nfo-'))
    const appData = join(dir, 'app-data')
    const file = join(dir, 'The Matrix (1999).mkv')
    const cached = cachedSidecarPathsFor(file, appData)
    mkdirSync(dirname(cached.nfo), { recursive: true })
    writeFileSync(cached.nfo, movieToNfoXml(movie))

    expect(readSidecarNfo(file, appData)?.tmdbId).toBe(603)
  })

  it('refreshes the cached NFO when the source sidecar is available', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mw-nfo-'))
    const appData = join(dir, 'app-data')
    const file = join(dir, 'The Matrix (1999).mkv')
    writeFileSync(sidecarPathsFor(file).nfo, movieToNfoXml(movie))

    expect(readSidecarNfo(file, appData)?.tmdbId).toBe(603)

    const cached = cachedSidecarPathsFor(file, appData)
    expect(existsSync(cached.nfo)).toBe(true)
    expect(readFileSync(cached.nfo, 'utf8')).toContain('<title>The Matrix</title>')
  })
})

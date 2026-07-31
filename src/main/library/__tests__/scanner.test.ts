import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { discoverVideoFiles, ingestFile, movieId, VIDEO_EXTENSIONS } from '../scanner'
import { cachedSidecarPathsFor, movieToNfoXml, sidecarPathsFor } from '../nfo'
import type { MovieRecord } from '../../../shared/types'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mw-scan-'))
  return () => rmSync(root, { recursive: true, force: true })
})

describe('VIDEO_EXTENSIONS', () => {
  it('contains exactly the supported set', () => {
    expect([...VIDEO_EXTENSIONS].sort()).toEqual(
      ['.mkv', '.mp4', '.avi', '.mov', '.m4v', '.wmv', '.webm'].sort()
    )
  })
})

describe('movieId', () => {
  it('is the stable sha1 hex of the path', () => {
    expect(movieId('/a/b.mkv')).toBe(movieId('/a/b.mkv'))
    expect(movieId('/a/b.mkv')).toMatch(/^[0-9a-f]{40}$/)
    expect(movieId('/a/b.mkv')).not.toBe(movieId('/a/c.mkv'))
  })
})

describe('discoverVideoFiles', () => {
  it('finds only video files, recursively, ignoring sidecars and junk', async () => {
    mkdirSync(join(root, 'The Matrix (1999)'))
    writeFileSync(join(root, 'The Matrix (1999)', 'The Matrix (1999).mkv'), 'x')
    writeFileSync(join(root, 'The Matrix (1999)', 'The Matrix (1999).nfo'), '<movie/>')
    writeFileSync(join(root, 'The Matrix (1999)', 'The Matrix (1999)-poster.jpg'), 'x')
    writeFileSync(join(root, 'Alien.mp4'), 'x')
    writeFileSync(join(root, 'notes.txt'), 'x')
    const files = await discoverVideoFiles(root)
    expect(files).toEqual([
      join(root, 'Alien.mp4'),
      join(root, 'The Matrix (1999)', 'The Matrix (1999).mkv')
    ])
  })
})

describe('ingestFile', () => {
  it('creates a pending record from the filename when no NFO exists', async () => {
    const file = join(root, 'Heat.1995.1080p.mkv')
    writeFileSync(file, 'xx')
    const m = await ingestFile(file, root)
    expect(m).toMatchObject({
      id: movieId(file),
      filePath: file,
      folderPath: root,
      fileSize: 2,
      parsedTitle: 'Heat',
      parsedYear: 1995,
      matchStatus: 'pending',
      tmdbId: null,
      playCount: 0,
      fileMissing: false
    })
  })

  it('falls back to the parent folder name when the filename is unhelpful', async () => {
    const dir = join(root, 'The Matrix (1999)')
    mkdirSync(dir)
    const file = join(dir, 'movie.mkv')
    writeFileSync(file, 'x')
    const m = await ingestFile(file, root)
    expect(m.matchStatus).toBe('pending')
    expect(m.parsedTitle).toBe('The Matrix')
    expect(m.parsedYear).toBe(1999)
  })

  it('ingests an existing NFO as matched, wiring artwork paths that exist on disk', async () => {
    const file = join(root, 'The Matrix (1999).mkv')
    writeFileSync(file, 'x')
    const matched: Partial<MovieRecord> = {
      parsedTitle: 'The Matrix',
      parsedYear: 1999,
      matchStatus: 'matched',
      tmdbId: 603,
      title: 'The Matrix',
      year: 1999,
      genres: ['Action'],
      cast: [],
      certifications: { AU: 'MA15+' },
      certificationAu: 'MA15+',
      playCount: 3,
      lastPlayedAt: '2026-07-01T10:00:00.000Z'
    }
    writeFileSync(
      sidecarPathsFor(file).nfo,
      movieToNfoXml({ ...(await ingestFile(file, root)), ...matched } as MovieRecord)
    )
    writeFileSync(sidecarPathsFor(file).poster, 'img')
    const m = await ingestFile(file, root)
    expect(m.matchStatus).toBe('matched')
    expect(m.tmdbId).toBe(603)
    expect(m.playCount).toBe(3)
    expect(m.posterPath).toBe(sidecarPathsFor(file).poster)
    expect(m.fanartPath).toBeNull() // fanart file absent
  })

  it('ingests cached metadata and artwork when source sidecars are missing', async () => {
    const appData = join(root, 'app-data')
    const file = join(root, 'The Matrix (1999).mkv')
    writeFileSync(file, 'x')
    const cached = cachedSidecarPathsFor(file, appData)
    mkdirSync(dirname(cached.nfo), { recursive: true })
    writeFileSync(cached.nfo, movieToNfoXml({ ...(await ingestFile(file, root)), ...matchedMovie() }))
    writeFileSync(cached.poster, 'poster')
    writeFileSync(cached.fanart, 'fanart')

    const m = await ingestFile(file, root, { appDataPath: appData })

    expect(m.matchStatus).toBe('matched')
    expect(m.tmdbId).toBe(603)
    expect(m.posterPath).toBe(cached.poster)
    expect(m.fanartPath).toBe(cached.fanart)
  })

  it('refreshes cached sidecars from source files when they are available', async () => {
    const appData = join(root, 'app-data')
    const file = join(root, 'The Matrix (1999).mkv')
    writeFileSync(file, 'x')
    const source = sidecarPathsFor(file)
    writeFileSync(source.nfo, movieToNfoXml({ ...(await ingestFile(file, root)), ...matchedMovie() }))
    writeFileSync(source.poster, 'poster')
    writeFileSync(source.fanart, 'fanart')

    const m = await ingestFile(file, root, { appDataPath: appData })
    const cached = cachedSidecarPathsFor(file, appData)

    expect(m.posterPath).toBe(source.poster)
    expect(m.fanartPath).toBe(source.fanart)
    expect(existsSync(cached.nfo)).toBe(true)
    expect(existsSync(cached.poster)).toBe(true)
    expect(existsSync(cached.fanart)).toBe(true)
  })

  it('keeps cached artwork paths when source artwork is missing', async () => {
    const appData = join(root, 'app-data')
    const file = join(root, 'The Matrix (1999).mkv')
    writeFileSync(file, 'x')
    const cached = cachedSidecarPathsFor(file, appData)
    mkdirSync(dirname(cached.nfo), { recursive: true })
    writeFileSync(cached.nfo, movieToNfoXml({ ...(await ingestFile(file, root)), ...matchedMovie() }))
    writeFileSync(cached.poster, 'poster')

    const m = await ingestFile(file, root, { appDataPath: appData })

    expect(m.posterPath).toBe(cached.poster)
    expect(m.fanartPath).toBeNull()
  })

  it('returns usable cached artwork without probing the Drive source when cache exists (REQ-038)', async () => {
    const appData = join(root, 'app-data')
    const file = join(root, 'The Matrix (1999).mkv')
    writeFileSync(file, 'x')
    const source = sidecarPathsFor(file)
    const cached = cachedSidecarPathsFor(file, appData)
    mkdirSync(dirname(cached.nfo), { recursive: true })
    writeFileSync(cached.nfo, movieToNfoXml({ ...(await ingestFile(file, root)), ...matchedMovie() }))
    // Distinct cache bytes: if resolveArtworkPath probed source it would mirror
    // and overwrite these (REQ-038 must prefer cache without touching source).
    writeFileSync(cached.poster, 'cache-poster')
    writeFileSync(cached.fanart, 'cache-fanart')
    writeFileSync(source.poster, 'drive-poster')
    writeFileSync(source.fanart, 'drive-fanart')

    const m = await ingestFile(file, root, { appDataPath: appData })

    expect(m.cachedPosterPath).toBe(cached.poster)
    expect(m.cachedFanartPath).toBe(cached.fanart)
    expect(m.posterPath).toBe(cached.poster)
    expect(m.fanartPath).toBe(cached.fanart)
    expect(readFileSync(cached.poster, 'utf8')).toBe('cache-poster')
    expect(readFileSync(cached.fanart, 'utf8')).toBe('cache-fanart')
  })

  it('preferCache skips Drive source NFO/art probes when app-owned cache already has them (REQ-039)', async () => {
    const appData = join(root, 'app-data')
    const file = join(root, 'The Matrix (1999).mkv')
    writeFileSync(file, 'x')
    const source = sidecarPathsFor(file)
    const cached = cachedSidecarPathsFor(file, appData)
    mkdirSync(dirname(cached.nfo), { recursive: true })
    const cachedMeta = { ...matchedMovie(), title: 'Cached Title', playCount: 9 }
    writeFileSync(
      cached.nfo,
      movieToNfoXml({ ...(await ingestFile(file, root)), ...cachedMeta } as MovieRecord)
    )
    writeFileSync(cached.poster, 'cache-poster')
    writeFileSync(cached.fanart, 'cache-fanart')
    // Source sidecars differ — preferCache must not read/mirror them.
    writeFileSync(
      source.nfo,
      movieToNfoXml({
        ...(await ingestFile(file, root)),
        ...matchedMovie(),
        title: 'Drive Title',
        playCount: 1
      } as MovieRecord)
    )
    writeFileSync(source.poster, 'drive-poster')
    writeFileSync(source.fanart, 'drive-fanart')

    const m = await ingestFile(file, root, { appDataPath: appData, preferCache: true })

    expect(m.title).toBe('Cached Title')
    expect(m.playCount).toBe(9)
    expect(m.posterPath).toBe(cached.poster)
    expect(m.fanartPath).toBe(cached.fanart)
    expect(m.cachedPosterPath).toBe(cached.poster)
    expect(m.cachedFanartPath).toBe(cached.fanart)
    expect(readFileSync(cached.nfo, 'utf8')).toContain('Cached Title')
    expect(readFileSync(cached.poster, 'utf8')).toBe('cache-poster')
    expect(readFileSync(cached.fanart, 'utf8')).toBe('cache-fanart')
  })

  it('without preferCache, source NFO still wins over cache (rescan reconcile)', async () => {
    const appData = join(root, 'app-data')
    const file = join(root, 'The Matrix (1999).mkv')
    writeFileSync(file, 'x')
    const source = sidecarPathsFor(file)
    const cached = cachedSidecarPathsFor(file, appData)
    mkdirSync(dirname(cached.nfo), { recursive: true })
    writeFileSync(
      cached.nfo,
      movieToNfoXml({
        ...(await ingestFile(file, root)),
        ...matchedMovie(),
        title: 'Cached Title'
      } as MovieRecord)
    )
    writeFileSync(
      source.nfo,
      movieToNfoXml({
        ...(await ingestFile(file, root)),
        ...matchedMovie(),
        title: 'Drive Title'
      } as MovieRecord)
    )

    const m = await ingestFile(file, root, { appDataPath: appData, preferCache: false })
    expect(m.title).toBe('Drive Title')
  })
})

function matchedMovie(): Partial<MovieRecord> {
  return {
    parsedTitle: 'The Matrix',
    parsedYear: 1999,
    matchStatus: 'matched',
    tmdbId: 603,
    title: 'The Matrix',
    year: 1999,
    genres: ['Action'],
    cast: [],
    certifications: { AU: 'MA15+' },
    certificationAu: 'MA15+',
    playCount: 3,
    lastPlayedAt: '2026-07-01T10:00:00.000Z'
  }
}

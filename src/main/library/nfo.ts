import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import type { CastMember, MovieRecord } from '../../shared/types'

export interface NfoData {
  tmdbId: number | null
  title: string | null
  originalTitle: string | null
  year: number | null
  overview: string | null
  runtime: number | null
  voteAverage: number | null
  genres: string[]
  cast: CastMember[]
  certifications: Record<string, string>
  certificationAu: string | null
  trailerYoutubeKey: string | null
  playCount: number
  lastPlayedAt: string | null
}

export function sidecarPathsFor(filePath: string): {
  nfo: string
  poster: string
  fanart: string
} {
  const stem = filePath.replace(/\.[^.]+$/, '')
  return { nfo: `${stem}.nfo`, poster: `${stem}-poster.jpg`, fanart: `${stem}-fanart.jpg` }
}

export function cachedSidecarPathsFor(
  filePath: string,
  appDataPath: string
): {
  nfo: string
  poster: string
  fanart: string
} {
  const key = createHash('sha1').update(filePath).digest('hex')
  const dir = join(appDataPath, 'cache', 'sidecars', key)
  return {
    nfo: join(dir, 'metadata.nfo'),
    poster: join(dir, 'poster.jpg'),
    fanart: join(dir, 'fanart.jpg')
  }
}

const TRAILER_PREFIX = 'plugin://plugin.video.youtube/?action=play_video&videoid='

export function movieToNfoXml(m: MovieRecord): string {
  const asList = <T>(v: T[]): T[] | undefined => (v.length ? v : undefined)
  const doc = {
    movie: {
      title: m.title ?? m.parsedTitle,
      originaltitle: m.originalTitle ?? undefined,
      year: m.year ?? undefined,
      plot: m.overview ?? undefined,
      runtime: m.runtime ?? undefined,
      rating: m.voteAverage ?? undefined,
      mpaa: Object.keys(m.certifications).length
        ? [
            'AU',
            ...Object.keys(m.certifications)
              .filter((c) => c !== 'AU')
              .sort()
          ]
            .filter((c) => m.certifications[c])
            .map((c) => `${c}:${m.certifications[c]}`)
            .join(' / ')
        : undefined,
      playcount: m.playCount,
      lastplayed: m.lastPlayedAt ?? undefined,
      trailer: m.trailerYoutubeKey ? TRAILER_PREFIX + m.trailerYoutubeKey : undefined,
      uniqueid:
        m.tmdbId != null ? { '@_type': 'tmdb', '@_default': 'true', '#text': m.tmdbId } : undefined,
      genre: asList(m.genres),
      actor: asList(m.cast.map((c) => ({ name: c.name, order: c.order })))
    }
  }
  return new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    suppressEmptyNode: true
  }).build(doc)
}

export function parseNfoXml(xml: string): NfoData {
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml)
  const mv = parsed.movie ?? {}
  const list = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v])
  const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
  const str = (v: unknown): string | null => (v == null || v === '' ? null : String(v))

  const certifications: Record<string, string> = {}
  for (const part of String(mv.mpaa ?? '').split(' / ')) {
    const [country, ...rest] = part.split(':')
    if (country && rest.length) certifications[country.trim()] = rest.join(':').trim()
  }

  const uniqueids = list(mv.uniqueid)
  const tmdbEntry = uniqueids.find((u: Record<string, unknown>) => u['@_type'] === 'tmdb')

  const trailer = str(mv.trailer)
  return {
    tmdbId: tmdbEntry ? num(tmdbEntry['#text']) : null,
    title: str(mv.title),
    originalTitle: str(mv.originaltitle),
    year: num(mv.year),
    overview: str(mv.plot),
    runtime: num(mv.runtime),
    voteAverage: num(mv.rating),
    genres: list(mv.genre).map(String),
    cast: list(mv.actor).map((a: Record<string, unknown>) => ({
      name: String(a.name),
      order: Number(a.order ?? 0)
    })),
    certifications,
    certificationAu: certifications['AU'] ?? null,
    trailerYoutubeKey: trailer?.startsWith(TRAILER_PREFIX)
      ? trailer.slice(TRAILER_PREFIX.length)
      : null,
    playCount: num(mv.playcount) ?? 0,
    lastPlayedAt: str(mv.lastplayed)
  }
}

export function writeSidecarNfo(movie: MovieRecord): void {
  writeFileSync(sidecarPathsFor(movie.filePath).nfo, movieToNfoXml(movie))
}

function tryReadText(path: string): string | null {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : null
  } catch {
    return null
  }
}

function writeCachedText(path: string, value: string): void {
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, value, 'utf8')
  } catch {
    // Cache refresh is best-effort; source sidecar ingestion should still work.
  }
}

export interface ReadSidecarNfoOptions {
  /**
   * When true and app-owned cache has an NFO, return it without probing the
   * movie-folder source sidecar (startup/background scans over Google Drive).
   */
  preferCache?: boolean
}

export function readSidecarNfo(
  filePath: string,
  appDataPath?: string,
  options?: ReadSidecarNfoOptions
): NfoData | null {
  const preferCache = options?.preferCache === true

  if (preferCache && appDataPath) {
    const cachedXml = tryReadText(cachedSidecarPathsFor(filePath, appDataPath).nfo)
    if (cachedXml != null) return parseNfoXml(cachedXml)
  }

  const { nfo } = sidecarPathsFor(filePath)
  const sourceXml = tryReadText(nfo)
  if (sourceXml != null) {
    if (appDataPath) writeCachedText(cachedSidecarPathsFor(filePath, appDataPath).nfo, sourceXml)
    return parseNfoXml(sourceXml)
  }

  if (preferCache) return null
  if (!appDataPath) return null
  const cachedXml = tryReadText(cachedSidecarPathsFor(filePath, appDataPath).nfo)
  return cachedXml == null ? null : parseNfoXml(cachedXml)
}

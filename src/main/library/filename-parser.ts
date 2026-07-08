import type { ParsedFilename } from '../../shared/types'

// Everything from the first release-tag onward is noise.
const RELEASE_TAGS =
  /\b(480p|576p|720p|1080p|2160p|4k|uhd|bluray|blu-ray|bdrip|brrip|webrip|web-dl|webdl|hdtv|dvdrip|hdrip|remux|x264|x265|h\.?264|h\.?265|hevc|avc|aac|ac3|dts|atmos|10bit|hdr|proper|repack|remastered|extended|unrated|imax|korean|directors cut)\b.*$/i

// A plausible film-year sits in 1900–2099; a resolution like 2160 falls outside it.
const YEAR = /(?:^|[( ])((?:19|20)\d{2})(?:[) ]|$)/g

/**
 * Extract a clean title and optional year from a movie filename.
 *
 * Strips release tags (1080p, BluRay, x264, ...), converts dots/underscores to
 * spaces, and pulls out an in-range 4-digit year. When the filename alone is
 * unhelpful (e.g. `movie.mkv`), the caller can instead pass the parent folder
 * name (e.g. `The Matrix (1999)`) — folder names carry no extension, so they
 * pass through the same logic unchanged (UR-001 fallback).
 */
export function parseFilename(basename: string): ParsedFilename {
  const stem = basename.replace(/\.[^.]+$/, '')
  let working = stem.replace(/[._]/g, ' ').replace(/[[\]]/g, ' ').replace(/\s+/g, ' ').trim()

  let year: number | null = null
  // Last standalone 19xx/20xx not at position 0 (so "2001 A Space Odyssey" keeps its title).
  const matches = [...working.matchAll(YEAR)].filter((m) => (m.index ?? 0) > 0)
  const last = matches.at(-1)
  if (last) {
    year = Number(last[1])
    working = working.slice(0, last.index)
  }

  working = working.replace(RELEASE_TAGS, '')
  const title = working
    .replace(/[({[\-\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { title: title || stem, year }
}

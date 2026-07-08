import type { MovieRecord, ParsedFilename } from '../../shared/types'
import type { TmdbMovieDetails, TmdbSearchResult } from './client'

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Return a search result only when we are confident: normalized titles must be
 * equal AND the release year within ±1. When the filename carried no year the
 * year check is skipped (title equality alone). Otherwise returns null.
 */
export function pickConfidentMatch(
  parsed: ParsedFilename,
  results: TmdbSearchResult[]
): TmdbSearchResult | null {
  const target = norm(parsed.title)
  for (const r of results.slice(0, 5)) {
    if (norm(r.title) !== target) continue
    if (parsed.year == null) return r
    const ry = r.release_date ? Number(r.release_date.slice(0, 4)) : null
    if (ry != null && Math.abs(ry - parsed.year) <= 1) return r
  }
  return null
}

/**
 * Map TMDB details onto a MovieRecord — the single place TMDB details become a
 * record, used by both auto-match and fix-match. Returns a NEW record (the input
 * is left untouched) with matchStatus 'matched' and every TMDB field populated.
 * `certificationAu` displays the AU rating, falling back US → GB → first-available
 * when TMDB has no AU release_dates entry; all countries are still stored in
 * `certifications`.
 */
export function applyDetails(movie: MovieRecord, d: TmdbMovieDetails): MovieRecord {
  const certifications: Record<string, string> = {}
  for (const entry of d.release_dates?.results ?? []) {
    const cert = entry.release_dates.map((r) => r.certification).find((c) => c !== '')
    if (cert) certifications[entry.iso_3166_1] = cert
  }
  const certificationAu =
    certifications['AU'] ??
    certifications['US'] ??
    certifications['GB'] ??
    Object.values(certifications)[0] ??
    null

  const videos = d.videos?.results?.filter((v) => v.site === 'YouTube') ?? []
  const trailer =
    videos.find((v) => v.type === 'Trailer' && v.official) ??
    videos.find((v) => v.type === 'Trailer') ??
    videos[0] ??
    null

  return {
    ...movie,
    matchStatus: 'matched',
    fetchFailed: false,
    tmdbId: d.id,
    title: d.title,
    originalTitle: d.original_title ?? null,
    year: d.release_date ? Number(d.release_date.slice(0, 4)) : null,
    overview: d.overview ?? null,
    runtime: d.runtime ?? null,
    voteAverage: d.vote_average ?? null,
    genres: (d.genres ?? []).map((g) => g.name),
    cast: (d.credits?.cast ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .slice(0, 5)
      .map((c) => ({ name: c.name, order: c.order })),
    certifications,
    certificationAu,
    trailerYoutubeKey: trailer?.key ?? null
  }
}

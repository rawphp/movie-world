import type { MovieRecord } from '../../../shared/types'

export interface LibraryFilters {
  search: string
  genre: string | null
  year: number | null
  certification: string | null
  minRating: number | null
  actor: string | null
  watched: 'all' | 'watched' | 'unwatched'
}

export type SortKey = 'title' | 'year' | 'rating' | 'lastWatched'

export const EMPTY_FILTERS: LibraryFilters = {
  search: '',
  genre: null,
  year: null,
  certification: null,
  minRating: null,
  actor: null,
  watched: 'all'
}

const displayTitle = (m: MovieRecord): string => m.title ?? m.parsedTitle

/** Collapse AU certification variants (MA15+ / MA 15+, R18+ / R 18+) for filters. */
export function normalizeCertification(cert: string): string {
  const compact = cert.replace(/\s+/g, '').toUpperCase()
  if (compact === 'MA15+') return 'MA 15+'
  if (compact === 'R18+') return 'R 18+'
  if (compact === 'R') return 'R'
  if (compact === 'M') return 'M'
  if (compact === 'PG') return 'PG'
  if (compact === 'G') return 'G'
  return cert.trim()
}

export function filtersAreActive(f: LibraryFilters): boolean {
  return (
    f.search.trim() !== '' ||
    f.genre != null ||
    f.year != null ||
    f.certification != null ||
    f.minRating != null ||
    (f.actor != null && f.actor.trim() !== '') ||
    f.watched !== 'all'
  )
}

export function filterMovies(movies: MovieRecord[], f: LibraryFilters): MovieRecord[] {
  const q = f.search.trim().toLowerCase()
  const actorQ = f.actor?.trim().toLowerCase() ?? ''
  const cert = f.certification ? normalizeCertification(f.certification) : null
  return movies.filter((m) => {
    if (q && !displayTitle(m).toLowerCase().includes(q)) return false
    if (f.genre && !m.genres.includes(f.genre)) return false
    if (f.year != null && (m.year ?? m.parsedYear) !== f.year) return false
    if (cert && (!m.certificationAu || normalizeCertification(m.certificationAu) !== cert))
      return false
    if (f.minRating != null && (m.voteAverage ?? -1) < f.minRating) return false
    if (actorQ && !m.cast.some((c) => c.name.toLowerCase().includes(actorQ))) return false
    if (f.watched === 'watched' && m.playCount === 0) return false
    if (f.watched === 'unwatched' && m.playCount > 0) return false
    return true
  })
}

export function sortMovies(movies: MovieRecord[], key: SortKey): MovieRecord[] {
  const arr = [...movies]
  switch (key) {
    case 'title':
      return arr.sort((a, b) => displayTitle(a).localeCompare(displayTitle(b)))
    case 'year':
      return arr.sort((a, b) => (b.year ?? b.parsedYear ?? 0) - (a.year ?? a.parsedYear ?? 0))
    case 'rating':
      return arr.sort((a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0))
    case 'lastWatched':
      return arr.sort((a, b) => (b.lastPlayedAt ?? '').localeCompare(a.lastPlayedAt ?? ''))
  }
}

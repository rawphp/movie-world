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

export function filterMovies(movies: MovieRecord[], f: LibraryFilters): MovieRecord[] {
  const q = f.search.trim().toLowerCase()
  return movies.filter((m) => {
    if (q && !displayTitle(m).toLowerCase().includes(q)) return false
    if (f.genre && !m.genres.includes(f.genre)) return false
    if (f.year != null && (m.year ?? m.parsedYear) !== f.year) return false
    if (f.certification && m.certificationAu !== f.certification) return false
    if (f.minRating != null && (m.voteAverage ?? -1) < f.minRating) return false
    if (f.actor && !m.cast.some((c) => c.name === f.actor)) return false
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

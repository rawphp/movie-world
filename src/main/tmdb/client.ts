export interface TmdbSearchResult {
  id: number
  title: string
  release_date?: string
  poster_path?: string | null
  overview?: string
}

export interface TmdbMovieDetails {
  id: number
  title: string
  original_title?: string
  release_date?: string
  overview?: string
  runtime?: number | null
  vote_average?: number
  genres?: Array<{ id: number; name: string }>
  poster_path?: string | null
  backdrop_path?: string | null
  credits?: { cast?: Array<{ name: string; order: number }> }
  videos?: { results?: Array<{ site: string; type: string; key: string; official?: boolean }> }
  release_dates?: {
    results?: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }>
  }
}

/** Thrown on a non-2xx TMDB response so the fetch queue can retry or surface the failure. */
export class TmdbError extends Error {
  constructor(public status: number) {
    super(`TMDB request failed with status ${status}`)
    this.name = 'TmdbError'
  }
}

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/'

export const imageUrl = (path: string, size: 'w500' | 'original'): string =>
  `${TMDB_IMAGE_BASE}${size}${path}`

export interface TmdbClient {
  searchMovies(query: string, year?: number | null): Promise<TmdbSearchResult[]>
  getMovieDetails(id: number): Promise<TmdbMovieDetails>
}

/**
 * Build a thin TMDB v3 client. `fetchFn` is injectable so tests run against a
 * mock; the manager supplies the real `fetch` in production.
 */
export function createTmdbClient(apiKey: string, fetchFn: typeof fetch = fetch): TmdbClient {
  async function get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`https://api.themoviedb.org/3${path}`)
    url.searchParams.set('api_key', apiKey)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await fetchFn(url)
    if (!res.ok) throw new TmdbError(res.status)
    return res.json() as Promise<T>
  }

  return {
    searchMovies: async (query: string, year?: number | null): Promise<TmdbSearchResult[]> =>
      (
        await get<{ results: TmdbSearchResult[] }>('/search/movie', {
          query,
          ...(year ? { year: String(year) } : {})
        })
      ).results,
    getMovieDetails: (id: number): Promise<TmdbMovieDetails> =>
      get<TmdbMovieDetails>(`/movie/${id}`, { append_to_response: 'credits,videos,release_dates' })
  }
}

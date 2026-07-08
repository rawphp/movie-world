import { describe, it, expect, vi } from 'vitest'
import { createTmdbClient, TmdbError, imageUrl, TMDB_IMAGE_BASE } from '../client'

function fakeFetch(payload: unknown, ok = true, status = 200): typeof fetch {
  return vi.fn(async () => ({ ok, status, json: async () => payload })) as unknown as typeof fetch
}

describe('tmdb client', () => {
  it('searches with query, year and api key', async () => {
    const f = fakeFetch({ results: [{ id: 603, title: 'The Matrix', release_date: '1999-03-30' }] })
    const client = createTmdbClient('KEY', f)
    const results = await client.searchMovies('The Matrix', 1999)
    expect(results[0].id).toBe(603)
    const url = new URL(String((f as ReturnType<typeof vi.fn>).mock.calls[0][0]))
    expect(url.pathname).toBe('/3/search/movie')
    expect(url.searchParams.get('query')).toBe('The Matrix')
    expect(url.searchParams.get('year')).toBe('1999')
    expect(url.searchParams.get('api_key')).toBe('KEY')
  })

  it('omits the year param when no year is provided', async () => {
    const f = fakeFetch({ results: [] })
    await createTmdbClient('KEY', f).searchMovies('Alien')
    const url = new URL(String((f as ReturnType<typeof vi.fn>).mock.calls[0][0]))
    expect(url.searchParams.has('year')).toBe(false)
  })

  it('requests details with append_to_response', async () => {
    const f = fakeFetch({ id: 603 })
    await createTmdbClient('KEY', f).getMovieDetails(603)
    const url = new URL(String((f as ReturnType<typeof vi.fn>).mock.calls[0][0]))
    expect(url.pathname).toBe('/3/movie/603')
    expect(url.searchParams.get('append_to_response')).toBe('credits,videos,release_dates')
  })

  it('throws TmdbError with status on non-ok response', async () => {
    const f = fakeFetch({}, false, 429)
    await expect(createTmdbClient('KEY', f).searchMovies('x')).rejects.toThrowError(TmdbError)
    try {
      await createTmdbClient('KEY', f).searchMovies('x')
    } catch (err) {
      expect((err as TmdbError).status).toBe(429)
    }
  })

  it('builds image urls for each size', () => {
    expect(imageUrl('/p.jpg', 'w500')).toBe(`${TMDB_IMAGE_BASE}w500/p.jpg`)
    expect(imageUrl('/p.jpg', 'original')).toBe('https://image.tmdb.org/t/p/original/p.jpg')
  })
})

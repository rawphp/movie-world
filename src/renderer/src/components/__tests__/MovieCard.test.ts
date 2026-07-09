// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MovieCard from '../MovieCard.vue'
import type { MovieRecord } from '../../../../shared/types'

const base: MovieRecord = {
  id: 'id1',
  filePath: '/f.mkv',
  fileSize: 0,
  folderPath: '/',
  parsedTitle: 'Parsed Name',
  parsedYear: 1999,
  matchStatus: 'matched',
  tmdbId: 603,
  title: 'The Matrix',
  originalTitle: null,
  year: 1999,
  overview: null,
  runtime: 136,
  voteAverage: 8.2,
  genres: ['Action'],
  cast: [
    { name: 'Keanu Reeves', order: 0 },
    { name: 'Laurence Fishburne', order: 1 }
  ],
  certifications: { AU: 'MA15+' },
  certificationAu: 'MA15+',
  trailerYoutubeKey: null,
  playCount: 0,
  lastPlayedAt: null,
  fileMissing: false,
  sidecarWriteFailed: false,
  fetchFailed: false,
  posterPath: '/art/p.jpg',
  fanartPath: null
}

describe('MovieCard', () => {
  it('shows title, year, certification, actors and "never" watched state', () => {
    const w = mount(MovieCard, { props: { movie: base } })
    expect(w.text()).toContain('The Matrix')
    expect(w.text()).toContain('1999')
    expect(w.text()).toContain('MA15+')
    expect(w.text()).toContain('Keanu Reeves')
    expect(w.text().toLowerCase()).toContain('never')
    expect(w.find('img').attributes('src')).toContain('mw-art://')
  })

  it('uses cached poster artwork before the source sidecar path', () => {
    const w = mount(MovieCard, {
      props: {
        movie: {
          ...base,
          posterPath: '/Google Drive/Movies/The Matrix-poster.jpg',
          cachedPosterPath: '/Users/me/Library/Application Support/movie-world/cache/poster.jpg'
        }
      }
    })

    const src = w.find('img').attributes('src')
    expect(src).toContain(
      encodeURIComponent('/Users/me/Library/Application Support/movie-world/cache/poster.jpg')
    )
    expect(src).not.toContain(encodeURIComponent('/Google Drive/Movies/The Matrix-poster.jpg'))
  })

  it('falls back to parsed title and shows pending badge', () => {
    const w = mount(MovieCard, {
      props: { movie: { ...base, matchStatus: 'pending', title: null, posterPath: null } }
    })
    expect(w.text()).toContain('Parsed Name')
    expect(w.find('[data-testid="badge-pending"]').exists()).toBe(true)
  })

  it('shows unmatched / missing / unsaved / fetch-failed badges', () => {
    expect(
      mount(MovieCard, { props: { movie: { ...base, matchStatus: 'unmatched' } } })
        .find('[data-testid="badge-unmatched"]')
        .exists()
    ).toBe(true)
    expect(
      mount(MovieCard, { props: { movie: { ...base, fileMissing: true } } })
        .find('[data-testid="badge-missing"]')
        .exists()
    ).toBe(true)
    expect(
      mount(MovieCard, { props: { movie: { ...base, sidecarWriteFailed: true } } })
        .find('[data-testid="badge-unsaved"]')
        .exists()
    ).toBe(true)
    expect(
      mount(MovieCard, { props: { movie: { ...base, fetchFailed: true } } })
        .find('[data-testid="badge-fetch-failed"]')
        .exists()
    ).toBe(true)
  })

  it('shows no state badge for a matched movie with no error flags', () => {
    const w = mount(MovieCard, { props: { movie: base } })
    expect(w.find('[data-testid="badge-pending"]').exists()).toBe(false)
    expect(w.find('[data-testid="badge-unmatched"]').exists()).toBe(false)
    expect(w.find('[data-testid="badge-missing"]').exists()).toBe(false)
    expect(w.find('[data-testid="badge-unsaved"]').exists()).toBe(false)
    expect(w.find('[data-testid="badge-fetch-failed"]').exists()).toBe(false)
  })

  it('emits open with the movie id on click', async () => {
    const w = mount(MovieCard, { props: { movie: base } })
    await w.trigger('click')
    expect(w.emitted('open')).toEqual([['id1']])
  })
})

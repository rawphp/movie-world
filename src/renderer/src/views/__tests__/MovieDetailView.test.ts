// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MovieDetailView from '../MovieDetailView.vue'
import { useLibraryStore } from '../../stores/library'
import type { MovieRecord } from '../../../../shared/types'

let routeId = 'movie-1'
const push = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: routeId } }),
  useRouter: () => ({ push })
}))

const makeMovie = (overrides: Partial<MovieRecord> = {}): MovieRecord => ({
  id: 'movie-1',
  filePath: '/movies/Example (2024).mkv',
  fileSize: 1024 ** 3,
  folderPath: '/movies',
  parsedTitle: 'Example',
  parsedYear: 2024,
  matchStatus: 'matched',
  tmdbId: 123,
  title: 'Example',
  originalTitle: 'Example',
  year: 2024,
  overview: 'A test movie.',
  runtime: 100,
  voteAverage: 7,
  genres: ['Drama'],
  cast: [{ name: 'Actor One', order: 0 }],
  certifications: {},
  certificationAu: 'M',
  trailerYoutubeKey: null,
  playCount: 0,
  lastPlayedAt: null,
  fileMissing: false,
  sidecarWriteFailed: false,
  fetchFailed: false,
  posterPath: '/art/poster.jpg',
  fanartPath: '/art/fanart.jpg',
  ...overrides
})

function mountWithMovie(movie: MovieRecord): ReturnType<typeof mount> {
  setActivePinia(createPinia())
  window.api = {
    play: vi.fn(async () => {}),
    revealFile: vi.fn(async () => {}),
    retryFetch: vi.fn(async () => {})
  } as unknown as Window['api']

  const store = useLibraryStore()
  store.movies[movie.id] = movie
  routeId = movie.id

  return mount(MovieDetailView)
}

beforeEach(() => {
  push.mockReset()
})

describe('MovieDetailView', () => {
  it('renders fanart as a non-interactive full-page background layer', () => {
    const wrapper = mountWithMovie(makeMovie())

    const background = wrapper.get('[data-testid="detail-art-background"]')

    expect(background.attributes('style')).toContain('mw-art://')
    expect(background.attributes('style')).toContain(encodeURIComponent('/art/fanart.jpg'))
    expect(background.classes()).toContain('pointer-events-none')
  })

  it('falls back to poster artwork when fanart is unavailable', () => {
    const wrapper = mountWithMovie(makeMovie({ fanartPath: null }))

    const background = wrapper.get('[data-testid="detail-art-background"]')

    expect(background.attributes('style')).toContain('mw-art://')
    expect(background.attributes('style')).toContain(encodeURIComponent('/art/poster.jpg'))
  })

  it('uses a wider body container than max-w-5xl', () => {
    const wrapper = mountWithMovie(makeMovie())

    const body = wrapper.get('[data-testid="detail-body"]')

    expect(body.classes()).toContain('max-w-7xl')
    expect(body.classes()).not.toContain('max-w-5xl')
  })
})

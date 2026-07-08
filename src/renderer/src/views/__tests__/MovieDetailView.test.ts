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
  it('renders fanart as a non-interactive hero-band artwork layer', () => {
    const wrapper = mountWithMovie(makeMovie())

    const hero = wrapper.get('[data-testid="detail-hero"]')
    const background = wrapper.get('[data-testid="detail-hero-art"]')

    expect(hero.classes()).toContain('h-[45vh]')
    expect(background.attributes('style')).toContain('mw-art://')
    expect(background.attributes('style')).toContain(encodeURIComponent('/art/fanart.jpg'))
    expect(background.classes()).toContain('pointer-events-none')
    expect(background.classes()).not.toContain('blur-[1px]')
  })

  it('falls back to poster artwork when fanart is unavailable', () => {
    const wrapper = mountWithMovie(makeMovie({ fanartPath: null }))

    const background = wrapper.get('[data-testid="detail-hero-art"]')

    expect(background.attributes('style')).toContain('mw-art://')
    expect(background.attributes('style')).toContain(encodeURIComponent('/art/poster.jpg'))
  })

  it('uses a solid fallback hero surface when no artwork is available', () => {
    const wrapper = mountWithMovie(makeMovie({ fanartPath: null, posterPath: null }))

    const fallback = wrapper.get('[data-testid="detail-hero-fallback"]')

    expect(fallback.classes()).toContain('bg-neutral-950')
    expect(fallback.classes()).toContain('pointer-events-none')
  })

  it('renders compact file info without permanently showing the full path', () => {
    const movie = makeMovie({
      filePath: '/movies/Example (2024)/Example (2024).mkv',
      fileSize: 2.33 * 1024 ** 3
    })
    const wrapper = mountWithMovie(movie)

    const fileInfo = wrapper.get('[data-testid="detail-file-info"]')

    expect(fileInfo.text()).toContain('2.33 GB')
    expect(fileInfo.text()).toContain('Reveal in Finder')
    expect(wrapper.text()).not.toContain(movie.filePath)
    expect(fileInfo.attributes('title')).toBe(movie.filePath)
  })

  it('caps the trailer embed at a modest 16:9 width', () => {
    const wrapper = mountWithMovie(makeMovie({ trailerYoutubeKey: 'abc123' }))

    const trailer = wrapper.get('[data-testid="detail-trailer-frame"]')

    expect(trailer.classes()).toContain('aspect-video')
    expect(trailer.classes()).toContain('max-w-2xl')
  })

  it('uses a wider body container than max-w-5xl', () => {
    const wrapper = mountWithMovie(makeMovie())

    const body = wrapper.get('[data-testid="detail-body"]')

    expect(body.classes()).toContain('max-w-7xl')
    expect(body.classes()).not.toContain('max-w-5xl')
  })
})

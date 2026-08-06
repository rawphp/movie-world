// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LibraryView from '../LibraryView.vue'
import type { LibraryLoadResult, MovieRecord } from '../../../../shared/types'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push })
}))

const movie = (id = 'cached-movie'): MovieRecord => ({
  id,
  filePath: `/Movies/${id}.mkv`,
  fileSize: 0,
  folderPath: '/Movies',
  parsedTitle: id,
  parsedYear: null,
  matchStatus: 'matched',
  tmdbId: 1,
  title: id,
  originalTitle: null,
  year: 2024,
  overview: null,
  runtime: null,
  voteAverage: null,
  genres: [],
  cast: [],
  certifications: {},
  certificationAu: null,
  trailerYoutubeKey: null,
  playCount: 0,
  lastPlayedAt: null,
  fileMissing: false,
  sidecarWriteFailed: false,
  fetchFailed: false,
  posterPath: null,
  fanartPath: null
})

function mountLibrary(loadResult: LibraryLoadResult): ReturnType<typeof mount> {
  setActivePinia(createPinia())
  window.api = {
    getSettings: vi.fn(async () => ({
      folders: ['/Movies'],
      tmdbApiKey: 'KEY',
      keybindings: { prevMovie: 'ArrowLeft', nextMovie: 'ArrowRight' }
    })),
    loadLibrary: vi.fn(async () => loadResult),
    onMovieUpdated: vi.fn(),
    onMovieRemoved: vi.fn(),
    onScanProgress: vi.fn()
  } as unknown as Window['api']

  return mount(LibraryView, {
    global: {
      stubs: {
        FilterBar: { template: '<div data-testid="filter-bar" />' },
        MovieCard: {
          props: ['movie'],
          template: '<button data-testid="movie-card">{{ movie.id }}</button>'
        },
        RouterLink: { template: '<a><slot /></a>' }
      }
    }
  })
}

describe('LibraryView', () => {
  beforeEach(() => {
    push.mockReset()
  })

  it('shows cached/offline status while cached movies are visible during background scan', async () => {
    const wrapper = mountLibrary({
      movies: [movie()],
      status: {
        firstViewFromCache: true,
        backgroundScanRunning: true,
        unavailableFolders: []
      }
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="library-cache-status"]').text()).toContain('cached library')
    expect(wrapper.find('[data-testid="library-empty"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="movie-card"]')).toHaveLength(1)
  })

  it('keeps the empty-library state for no cached or scanned records', async () => {
    const wrapper = mountLibrary({
      movies: [],
      status: {
        firstViewFromCache: false,
        backgroundScanRunning: false,
        unavailableFolders: []
      }
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="library-cache-status"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="library-empty"]').text()).toContain('Your library is empty')
  })

  it('shows a no-results state when filters match nothing', async () => {
    const wrapper = mountLibrary({
      movies: [movie('alpha')],
      status: {
        firstViewFromCache: false,
        backgroundScanRunning: false,
        unavailableFolders: []
      }
    })
    await flushPromises()

    const { useLibraryStore } = await import('../../stores/library')
    const store = useLibraryStore()
    store.setFilter({ search: 'zzzz-no-match' })
    await flushPromises()

    expect(wrapper.get('[data-testid="library-no-results"]').text()).toContain(
      'No movies match your filters'
    )
    expect(wrapper.findAll('[data-testid="movie-card"]')).toHaveLength(0)
  })
})

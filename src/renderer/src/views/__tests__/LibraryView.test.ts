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
          emits: ['open', 'fixMatch'],
          template: `<div data-testid="movie-card">
            <button data-testid="stub-open" @click="$emit('open', movie.id)">{{ movie.id }}</button>
            <button
              v-if="movie.matchStatus === 'unmatched'"
              data-testid="card-fix-match"
              @click="$emit('fixMatch', movie.id)"
            >Fix match</button>
          </div>`
        },
        FixMatchDialog: {
          props: ['movie'],
          emits: ['close'],
          template:
            '<div data-testid="library-fix-match-dialog" :data-movie-id="movie.id">FixMatchDialog</div>'
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

  it('hides continue-watching strip when no movie has lastPlayedAt', async () => {
    const wrapper = mountLibrary({
      movies: [movie('alpha'), movie('beta')],
      status: {
        firstViewFromCache: false,
        backgroundScanRunning: false,
        unavailableFolders: []
      }
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="continue-watching"]').exists()).toBe(false)
  })

  it('shows continue-watching strip ordered by lastPlayedAt desc and capped at 12', async () => {
    // 14 watched titles + 1 never-watched. Cap is 12, newest first.
    // extras 0..10 → Jul 16..26 (newest); new → Jul 15; mid → Jun; old → Jan (falls off cap)
    const watched = [
      { ...movie('old'), playCount: 1, lastPlayedAt: '2026-01-01T00:00:00.000Z' },
      { ...movie('mid'), playCount: 1, lastPlayedAt: '2026-06-01T00:00:00.000Z' },
      { ...movie('new'), playCount: 1, lastPlayedAt: '2026-07-15T00:00:00.000Z' },
      ...Array.from({ length: 11 }, (_, i) => ({
        ...movie(`extra-${i}`),
        playCount: 1,
        lastPlayedAt: `2026-07-${String(16 + i).padStart(2, '0')}T00:00:00.000Z`
      }))
    ]
    const wrapper = mountLibrary({
      movies: [...watched, movie('never-watched')],
      status: {
        firstViewFromCache: false,
        backgroundScanRunning: false,
        unavailableFolders: []
      }
    })
    await flushPromises()

    const strip = wrapper.get('[data-testid="continue-watching"]')
    expect(strip.text()).toMatch(/Continue watching|Recently watched/i)

    const items = strip.findAll('[data-testid="continue-watching-item"]')
    expect(items).toHaveLength(12)
    // newest first: extra-10 (2026-07-26)
    expect(items[0].attributes('data-movie-id')).toBe('extra-10')
    const ids = items.map((w) => w.attributes('data-movie-id'))
    expect(ids).not.toContain('never-watched')
    // 14 watched → cap 12 drops oldest two (mid, old)
    expect(ids).not.toContain('old')
    expect(ids).not.toContain('mid')
    expect(ids).toContain('new')
  })

  it('navigates to movie detail when a continue-watching item is opened', async () => {
    const wrapper = mountLibrary({
      movies: [
        {
          ...movie('watched-one'),
          playCount: 2,
          lastPlayedAt: '2026-07-01T10:00:00.000Z'
        }
      ],
      status: {
        firstViewFromCache: false,
        backgroundScanRunning: false,
        unavailableFolders: []
      }
    })
    await flushPromises()

    await wrapper
      .get('[data-testid="continue-watching"]')
      .get('[data-testid="stub-open"]')
      .trigger('click')

    expect(push).toHaveBeenCalledWith('/movie/watched-one')
  })

  it('hosts Fix match dialog from an unmatched card without navigating to detail', async () => {
    const unmatched = { ...movie('needs-match'), matchStatus: 'unmatched' as const, tmdbId: null }
    const wrapper = mountLibrary({
      movies: [unmatched],
      status: {
        firstViewFromCache: false,
        backgroundScanRunning: false,
        unavailableFolders: []
      }
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="library-fix-match-dialog"]').exists()).toBe(false)

    await wrapper.get('[data-testid="card-fix-match"]').trigger('click')
    await flushPromises()

    const dialog = wrapper.get('[data-testid="library-fix-match-dialog"]')
    expect(dialog.attributes('data-movie-id')).toBe('needs-match')
    expect(push).not.toHaveBeenCalled()
  })

  it('keeps Fix match dialog open when the card leaves the filtered list', async () => {
    const unmatched = { ...movie('needs-match'), matchStatus: 'unmatched' as const, tmdbId: null }
    const wrapper = mountLibrary({
      movies: [unmatched, movie('other')],
      status: {
        firstViewFromCache: false,
        backgroundScanRunning: false,
        unavailableFolders: []
      }
    })
    await flushPromises()

    await wrapper.get('[data-testid="card-fix-match"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="library-fix-match-dialog"]').exists()).toBe(true)

    const { useLibraryStore } = await import('../../stores/library')
    const store = useLibraryStore()
    // Filter out the unmatched card from the grid (card unmounts) while store still holds it.
    store.setFilter({ search: 'other' })
    await flushPromises()

    expect(wrapper.findAll('[data-testid="movie-card"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="card-fix-match"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="library-fix-match-dialog"]').attributes('data-movie-id')).toBe(
      'needs-match'
    )
  })
})

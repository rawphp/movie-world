// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MovieDetailView from '../MovieDetailView.vue'
import { useLibraryStore } from '../../stores/library'
import type { Keybindings, MovieRecord } from '../../../../shared/types'

let routeId = 'movie-1'
const push = vi.fn()
const back = vi.fn()
const getSettings = vi.fn()
const defaultKeybindings: Keybindings = { prevMovie: 'Mod+ArrowLeft', nextMovie: 'Mod+ArrowRight' }

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })

  return { promise, resolve }
}

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: routeId } }),
  useRouter: () => ({ push, back })
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
  cachedPosterPath: '/userData/cache/art/poster.jpg',
  cachedFanartPath: '/userData/cache/art/fanart.jpg',
  ...overrides
})

function mountWithMovie(
  movie: MovieRecord,
  options: {
    list?: MovieRecord[]
    keybindings?: Keybindings
    settingsPromise?: Promise<unknown>
  } = {}
): ReturnType<typeof mount> {
  setActivePinia(createPinia())
  const settings = {
    folders: [],
    tmdbApiKey: null,
    keybindings: options.keybindings ?? defaultKeybindings
  }
  getSettings.mockReturnValue(options.settingsPromise ?? Promise.resolve(settings))
  window.api = {
    getSettings,
    play: vi.fn(async () => {}),
    revealFile: vi.fn(async () => {}),
    retryFetch: vi.fn(async () => {}),
    searchTmdb: vi.fn(async () => [])
  } as unknown as Window['api']

  const store = useLibraryStore()
  for (const item of options.list ?? [movie]) {
    store.movies[item.id] = item
  }
  routeId = movie.id

  return mount(MovieDetailView)
}

beforeEach(() => {
  push.mockReset()
  back.mockReset()
  getSettings.mockReset()
})

describe('MovieDetailView', () => {
  it('renders fanart as a non-interactive hero-band artwork layer', () => {
    const wrapper = mountWithMovie(makeMovie())

    const hero = wrapper.get('[data-testid="detail-hero"]')
    const background = wrapper.get('[data-testid="detail-hero-art"]')

    expect(hero.classes()).toContain('h-[42vh]')
    expect(background.attributes('style')).toContain('mw-art://')
    expect(background.attributes('style')).toContain(
      encodeURIComponent('/userData/cache/art/fanart.jpg')
    )
    expect(background.classes()).toContain('pointer-events-none')
    expect(background.classes()).not.toContain('blur-[1px]')
  })

  it('uses cached fanart for hero artwork and ignores Drive fanartPath', () => {
    const wrapper = mountWithMovie(
      makeMovie({
        fanartPath: '/Google Drive/Movies/Example-fanart.jpg',
        cachedFanartPath:
          '/Users/me/Library/Application Support/movie-world/cache/sidecars/fanart.jpg'
      })
    )

    const background = wrapper.get('[data-testid="detail-hero-art"]')

    expect(background.attributes('style')).toContain(
      encodeURIComponent(
        '/Users/me/Library/Application Support/movie-world/cache/sidecars/fanart.jpg'
      )
    )
    expect(background.attributes('style')).not.toContain(
      encodeURIComponent('/Google Drive/Movies/Example-fanart.jpg')
    )
  })

  it('falls back to cached poster when cached fanart is unavailable', () => {
    const wrapper = mountWithMovie(makeMovie({ fanartPath: null, cachedFanartPath: null }))

    const background = wrapper.get('[data-testid="detail-hero-art"]')

    expect(background.attributes('style')).toContain('mw-art://')
    expect(background.attributes('style')).toContain(
      encodeURIComponent('/userData/cache/art/poster.jpg')
    )
  })

  it('uses solid fallback hero when only Drive art paths are set (no cache)', () => {
    const wrapper = mountWithMovie(
      makeMovie({
        fanartPath: '/Google Drive/Movies/Example-fanart.jpg',
        posterPath: '/Google Drive/Movies/Example-poster.jpg',
        cachedFanartPath: null,
        cachedPosterPath: null
      })
    )

    const fallback = wrapper.get('[data-testid="detail-hero-fallback"]')

    expect(fallback.classes()).toContain('bg-neutral-950')
    expect(fallback.classes()).toContain('pointer-events-none')
    expect(wrapper.find('[data-testid="detail-hero-art"]').exists()).toBe(false)
    expect(wrapper.html()).not.toContain(
      encodeURIComponent('/Google Drive/Movies/Example-fanart.jpg')
    )
    expect(wrapper.html()).not.toContain(
      encodeURIComponent('/Google Drive/Movies/Example-poster.jpg')
    )
  })

  it('uses a solid fallback hero surface when no artwork is available', () => {
    const wrapper = mountWithMovie(
      makeMovie({
        fanartPath: null,
        posterPath: null,
        cachedFanartPath: null,
        cachedPosterPath: null
      })
    )

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

  it('offers an external YouTube fallback when a trailer key exists', () => {
    const wrapper = mountWithMovie(makeMovie({ trailerYoutubeKey: '0CYVGN98ZLA' }))

    const trailer = wrapper.get('[data-testid="detail-trailer-frame"]')
    const fallback = wrapper.get('[data-testid="detail-trailer-youtube-link"]')

    expect(trailer.find('iframe').attributes('src')).toBe(
      'https://www.youtube-nocookie.com/embed/0CYVGN98ZLA?origin=https%3A%2F%2Fwww.youtube-nocookie.com&rel=0&playsinline=1'
    )
    expect(fallback.attributes('href')).toBe('https://www.youtube.com/watch?v=0CYVGN98ZLA')
    expect(fallback.attributes('target')).toBe('_blank')
    expect(fallback.attributes('rel')).toContain('noopener')
  })

  it('uses a wider body container than max-w-5xl', () => {
    const wrapper = mountWithMovie(makeMovie())

    const body = wrapper.get('[data-testid="detail-body"]')

    expect(body.classes()).toContain('max-w-7xl')
    expect(body.classes()).not.toContain('max-w-5xl')
  })

  it('places primary actions on a solid bar below the hero, not over fanart', () => {
    const wrapper = mountWithMovie(makeMovie())

    const actionBar = wrapper.get('[data-testid="detail-action-bar"]')
    expect(actionBar.find('[data-testid="detail-play"]').exists()).toBe(true)
    expect(actionBar.find('[data-testid="detail-fix-match"]').exists()).toBe(true)
    expect(actionBar.find('[data-testid="detail-prev"]').exists()).toBe(true)
    expect(actionBar.find('[data-testid="detail-next"]').exists()).toBe(true)
    // Hero keeps title chrome only — Play must not live there.
    expect(
      wrapper
        .get('[data-testid="detail-hero-content"]')
        .find('[data-testid="detail-play"]')
        .exists()
    ).toBe(false)
    // Poster column no longer pulls up over the action row.
    expect(wrapper.get('[data-testid="detail-body"]').html()).not.toContain('md:-mt-24')
  })

  it('explains why Play is disabled when the file is missing', () => {
    const wrapper = mountWithMovie(makeMovie({ fileMissing: true }))

    const play = wrapper.get('[data-testid="detail-play"]')
    expect(play.attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="detail-file-missing-hint"]').text()).toContain('missing')
  })

  it('shows a friendly not-watched summary instead of 0× · never', () => {
    const wrapper = mountWithMovie(makeMovie({ playCount: 0, lastPlayedAt: null }))
    expect(wrapper.get('[data-testid="detail-watch-summary"]').text()).toBe('Not watched yet')
  })

  it('formats file size in human units', () => {
    const wrapper = mountWithMovie(makeMovie({ fileSize: 280 * 1024 ** 2 }))
    expect(wrapper.get('[data-testid="detail-file-size"]').text()).toContain('MB')
  })

  it('goes back on Escape when the fix-match dialog is closed', async () => {
    const wrapper = mountWithMovie(makeMovie())
    await flushPromises()
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
    // Prefer history.back when available; otherwise push library.
    expect(back.mock.calls.length + push.mock.calls.length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('uses settings keybindings to navigate to the next movie in store list order', async () => {
    const current = makeMovie({ id: 'movie-2', title: 'Beta' })
    const next = makeMovie({ id: 'movie-3', title: 'Gamma' })
    const wrapper = mountWithMovie(current, {
      list: [makeMovie({ id: 'movie-1', title: 'Alpha' }), current, next],
      keybindings: { prevMovie: 'Alt+[', nextMovie: 'Alt+]' }
    })
    await flushPromises()

    const event = new KeyboardEvent('keydown', {
      key: ']',
      altKey: true,
      bubbles: true,
      cancelable: true
    })
    window.dispatchEvent(event)

    expect(getSettings).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'movie', params: { id: next.id } })
    expect(event.defaultPrevented).toBe(true)
    wrapper.unmount()
  })

  it('suppresses configured navigation while fixing or typing in form targets', async () => {
    const current = makeMovie({ id: 'movie-1', title: 'Alpha' })
    const next = makeMovie({ id: 'movie-2', title: 'Beta' })
    const fixingWrapper = mountWithMovie(current, {
      list: [current, next],
      keybindings: { prevMovie: 'Alt+[', nextMovie: 'Alt+]' }
    })
    await flushPromises()

    await fixingWrapper.get('[data-testid="detail-fix-match"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ']', altKey: true, bubbles: true }))
    fixingWrapper.unmount()

    expect(push).not.toHaveBeenCalled()
    push.mockReset()

    const inputWrapper = mountWithMovie(current, {
      list: [current, next],
      keybindings: { prevMovie: 'Alt+[', nextMovie: 'Alt+]' }
    })
    await flushPromises()

    for (const tag of ['input', 'textarea', 'select']) {
      const target = document.createElement(tag)
      document.body.appendChild(target)
      target.dispatchEvent(new KeyboardEvent('keydown', { key: ']', altKey: true, bubbles: true }))
      target.remove()
    }

    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    document.body.appendChild(editable)
    editable.dispatchEvent(new KeyboardEvent('keydown', { key: ']', altKey: true, bubbles: true }))
    editable.remove()

    expect(push).not.toHaveBeenCalled()
    inputWrapper.unmount()
  })

  it('does not navigate or prevent default on non-matching keydowns', async () => {
    const current = makeMovie({ id: 'movie-1', title: 'Alpha' })
    const next = makeMovie({ id: 'movie-2', title: 'Beta' })
    const wrapper = mountWithMovie(current, {
      list: [current, next],
      keybindings: { prevMovie: 'Alt+[', nextMovie: 'Alt+]' }
    })
    await flushPromises()

    const event = new KeyboardEvent('keydown', { key: ']', ctrlKey: true, bubbles: true })
    window.dispatchEvent(event)

    expect(push).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    wrapper.unmount()
  })

  it('removes the keydown listener on unmount', async () => {
    const current = makeMovie({ id: 'movie-1', title: 'Alpha' })
    const next = makeMovie({ id: 'movie-2', title: 'Beta' })
    const wrapper = mountWithMovie(current, {
      list: [current, next],
      keybindings: { prevMovie: 'Alt+[', nextMovie: 'Alt+]' }
    })
    await flushPromises()

    wrapper.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ']', altKey: true, bubbles: true }))

    expect(push).not.toHaveBeenCalled()
  })

  it('does not leave a keydown listener when settings resolve after unmount', async () => {
    const current = makeMovie({ id: 'movie-1', title: 'Alpha' })
    const next = makeMovie({ id: 'movie-2', title: 'Beta' })
    const settings = deferred<{
      folders: string[]
      tmdbApiKey: null
      keybindings: Keybindings
    }>()
    const wrapper = mountWithMovie(current, {
      list: [current, next],
      settingsPromise: settings.promise
    })

    wrapper.unmount()
    settings.resolve({
      folders: [],
      tmdbApiKey: null,
      keybindings: { prevMovie: 'Alt+[', nextMovie: 'Alt+]' }
    })
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ']', altKey: true, bubbles: true }))

    expect(push).not.toHaveBeenCalled()
  })
})

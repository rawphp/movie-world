// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import FixMatchDialog from '../FixMatchDialog.vue'
import type { MovieRecord } from '../../../../shared/types'

const movie: MovieRecord = {
  id: 'id1',
  filePath: '/f.mkv',
  fileSize: 0,
  folderPath: '/',
  parsedTitle: 'Matrix',
  parsedYear: 1999,
  matchStatus: 'unmatched',
  tmdbId: null,
  title: null,
  originalTitle: null,
  year: null,
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
}

// Stub only `window.api` (jsdom exposes globals as window props) rather than
// replacing the whole `window`, which would clobber jsdom's Event constructors.
beforeEach(() => {
  vi.stubGlobal('api', {
    searchTmdb: vi.fn(async () => [
      { id: 603, title: 'The Matrix', release_date: '1999-03-30', poster_path: '/p.jpg' }
    ]),
    fixMatch: vi.fn(async () => {})
  })
})

describe('FixMatchDialog', () => {
  it('searches on mount with parsed title/year and applies a selected candidate', async () => {
    const w = mount(FixMatchDialog, { props: { movie } })
    await flushPromises()
    expect(window.api.searchTmdb).toHaveBeenCalledWith('Matrix', 1999)
    const candidate = w.find('[data-testid="fix-candidate"]')
    expect(candidate.text()).toContain('The Matrix')
    await candidate.trigger('click')
    expect(window.api.fixMatch).toHaveBeenCalledWith('id1', 603)
    expect(w.emitted('close')).toBeTruthy()
  })

  it('accepts a raw TMDB id', async () => {
    const w = mount(FixMatchDialog, { props: { movie } })
    await flushPromises()
    await w.find('[data-testid="fix-id-input"]').setValue('550')
    await w.find('[data-testid="fix-id-submit"]').trigger('click')
    expect(window.api.fixMatch).toHaveBeenCalledWith('id1', 550)
  })

  it('closes on Escape', async () => {
    const w = mount(FixMatchDialog, { props: { movie } })
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(w.emitted('close')).toBeTruthy()
  })

  it('displays the source filename from the movie file path', async () => {
    const w = mount(FixMatchDialog, {
      props: {
        movie: { ...movie, filePath: '/Movies/The Matrix (1999)/The.Matrix.1999.1080p.mkv' }
      }
    })
    await flushPromises()
    const source = w.find('[data-testid="fix-source-filename"]')
    expect(source.exists()).toBe(true)
    expect(source.text()).toContain('The.Matrix.1999.1080p.mkv')
  })

  it('keeps TMDB id controls in a sticky footer outside the scrollable results', async () => {
    const w = mount(FixMatchDialog, { props: { movie } })
    await flushPromises()
    const footer = w.find('[data-testid="fix-id-footer"]')
    expect(footer.exists()).toBe(true)
    expect(footer.find('[data-testid="fix-id-input"]').exists()).toBe(true)
    expect(footer.find('[data-testid="fix-id-submit"]').exists()).toBe(true)
    // Sticky / non-scrolling placement: footer is a flex child sibling of the scroll region
    expect(footer.classes().join(' ')).toMatch(/sticky|shrink-0/)
    const results = w.find('[data-testid="fix-results"]')
    expect(results.exists()).toBe(true)
    expect(results.classes().join(' ')).toMatch(/overflow-y-auto/)
  })
})

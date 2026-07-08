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
})

// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import FilterBar from '../FilterBar.vue'
import { useLibraryStore } from '../../stores/library'
import type { MovieRecord } from '../../../../shared/types'

beforeEach(() => setActivePinia(createPinia()))

const seed = (store: ReturnType<typeof useLibraryStore>): void => {
  const m = (id: string, over: Partial<MovieRecord>): MovieRecord => ({
    id,
    filePath: `/${id}`,
    fileSize: 0,
    folderPath: '/',
    parsedTitle: id,
    parsedYear: null,
    matchStatus: 'matched',
    tmdbId: 1,
    title: id,
    originalTitle: null,
    year: 2000,
    overview: null,
    runtime: null,
    voteAverage: 7,
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
    fanartPath: null,
    ...over
  })
  store.applyUpdate(m('a', { genres: ['Action'], certificationAu: 'M' }))
  store.applyUpdate(m('b', { genres: ['Horror'], certificationAu: 'R18+' }))
}

describe('FilterBar', () => {
  it('renders facet options derived from the store', () => {
    const store = useLibraryStore()
    seed(store)
    const w = mount(FilterBar)
    expect(w.find('[data-testid="filter-genre"]').text()).toContain('Action')
    expect(w.find('[data-testid="filter-certification"]').text()).toContain('R18+')
  })

  it('writes search and genre into the store', async () => {
    const store = useLibraryStore()
    seed(store)
    const w = mount(FilterBar)
    await w.find('[data-testid="filter-search"]').setValue('alien')
    await w.find('[data-testid="filter-genre"]').setValue('Horror')
    expect(store.filters.search).toBe('alien')
    expect(store.filters.genre).toBe('Horror')
  })

  it('writes the sort key into the store', async () => {
    const store = useLibraryStore()
    seed(store)
    const w = mount(FilterBar)
    await w.find('[data-testid="filter-sort"]').setValue('year')
    expect(store.sort).toBe('year')
  })
})

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
  store.applyUpdate(m('a', { genres: ['Action'], certificationAu: 'G' }))
  store.applyUpdate(m('b', { genres: ['Horror'], certificationAu: 'PG' }))
  store.applyUpdate(m('c', { genres: ['Drama'], certificationAu: 'R18+' }))
}

describe('FilterBar', () => {
  it('renders facet options derived from the store', () => {
    const store = useLibraryStore()
    seed(store)
    const w = mount(FilterBar)
    expect(w.find('[data-testid="filter-genre"]').text()).toContain('Action')
    expect(w.find('[data-testid="filter-certification"]').text()).toContain('R 18+')
    expect(w.find('[data-testid="filter-cert-chip-G"]').exists()).toBe(true)
    expect(w.find('[data-testid="filter-cert-chip-PG"]').exists()).toBe(true)
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

  it('exposes accessible names on filters and a result count', () => {
    const store = useLibraryStore()
    seed(store)
    const w = mount(FilterBar)
    expect(w.find('[data-testid="filter-search"]').attributes('aria-label')).toBe('Search movies')
    expect(w.find('[data-testid="filter-genre"]').attributes('aria-label')).toContain('genre')
    const cert = w.find('[data-testid="filter-certification"]')
    expect(cert.attributes('aria-label')).toMatch(/Australian classification multi-select/i)
    expect(w.find('[data-testid="filter-issue"]').text()).toContain('All movies')
    expect(w.find('[data-testid="library-result-count"]').text()).toMatch(/3 movies/)
  })

  it('filters actors by typed name and only shows Clear when filters are active', async () => {
    const store = useLibraryStore()
    seed(store)
    const w = mount(FilterBar)
    expect(w.find('[data-testid="filter-clear"]').exists()).toBe(false)
    await w.find('[data-testid="filter-actor"]').setValue('keanu')
    expect(store.filters.actor).toBe('keanu')
    expect(w.find('[data-testid="filter-clear"]').exists()).toBe(true)
  })

  it('writes the sort key into the store', async () => {
    const store = useLibraryStore()
    seed(store)
    const w = mount(FilterBar)
    await w.find('[data-testid="filter-sort"]').setValue('year')
    expect(store.sort).toBe('year')
  })

  it('multi-selects certifications and filters the list with OR', async () => {
    const store = useLibraryStore()
    seed(store)
    const w = mount(FilterBar)

    await w.find('[data-testid="filter-cert-chip-G"]').trigger('click')
    expect(store.filters.certification).toEqual(['G'])
    expect(store.list.map((m) => m.id)).toEqual(['a'])
    expect(w.find('[data-testid="filter-cert-chip-G"]').attributes('aria-pressed')).toBe('true')

    await w.find('[data-testid="filter-cert-chip-PG"]').trigger('click')
    expect(store.filters.certification).toEqual(['G', 'PG'])
    expect(store.list.map((m) => m.id).sort()).toEqual(['a', 'b'])
    expect(w.find('[data-testid="filter-cert-chip-PG"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('[data-testid="filter-clear"]').exists()).toBe(true)
  })

  it('toggles a certification chip off when clicked again', async () => {
    const store = useLibraryStore()
    seed(store)
    const w = mount(FilterBar)

    await w.find('[data-testid="filter-cert-chip-G"]').trigger('click')
    await w.find('[data-testid="filter-cert-chip-G"]').trigger('click')
    expect(store.filters.certification).toEqual([])
    expect(store.list).toHaveLength(3)
    expect(w.find('[data-testid="filter-cert-chip-G"]').attributes('aria-pressed')).toBe('false')
  })

  it('Clear filters resets the certification multi-select', async () => {
    const store = useLibraryStore()
    seed(store)
    const w = mount(FilterBar)

    await w.find('[data-testid="filter-cert-chip-G"]').trigger('click')
    await w.find('[data-testid="filter-cert-chip-PG"]').trigger('click')
    expect(store.filters.certification).toEqual(['G', 'PG'])

    await w.find('[data-testid="filter-clear"]').trigger('click')
    expect(store.filters.certification).toEqual([])
    expect(store.list).toHaveLength(3)
    expect(w.find('[data-testid="filter-cert-chip-G"]').attributes('aria-pressed')).toBe('false')
    expect(w.find('[data-testid="filter-cert-chip-PG"]').attributes('aria-pressed')).toBe('false')
    expect(w.find('[data-testid="filter-clear"]').exists()).toBe(false)
  })
})

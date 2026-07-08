// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLibraryStore } from '../library'
import type { MovieRecord } from '../../../../shared/types'

const m = (id: string, over: Partial<MovieRecord> = {}): MovieRecord => ({
  id,
  filePath: `/${id}`,
  fileSize: 0,
  folderPath: '/',
  parsedTitle: id,
  parsedYear: null,
  matchStatus: 'pending',
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
  fanartPath: null,
  ...over
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('window', {
    api: {
      loadLibrary: vi.fn(async () => [
        m('a'),
        m('b', { matchStatus: 'matched', genres: ['Action'], certificationAu: 'M', year: 2001 })
      ]),
      onMovieUpdated: vi.fn(),
      onScanProgress: vi.fn()
    }
  })
})

describe('library store', () => {
  it('load() populates movies and subscribes to updates', async () => {
    const store = useLibraryStore()
    await store.load()
    expect(store.list).toHaveLength(2)
    expect(store.loaded).toBe(true)
    expect(store.pendingCount).toBe(1)
    expect(window.api.onMovieUpdated).toHaveBeenCalledOnce()
  })

  it('a second load() does not double-subscribe', async () => {
    const store = useLibraryStore()
    await store.load()
    await store.load()
    expect(window.api.onMovieUpdated).toHaveBeenCalledOnce()
  })

  it('applyUpdate upserts and getters derive facets', async () => {
    const store = useLibraryStore()
    await store.load()
    store.applyUpdate(
      m('a', {
        matchStatus: 'matched',
        genres: ['Horror'],
        cast: [{ name: 'X', order: 0 }],
        certificationAu: 'PG',
        year: 1999
      })
    )
    expect(store.pendingCount).toBe(0)
    expect(store.allGenres).toEqual(['Action', 'Horror'])
    expect(store.allActors).toEqual(['X'])
    expect(store.allYears).toEqual([2001, 1999])
    expect(store.allCertifications).toEqual(['M', 'PG'])
  })

  it('setFilter, setSort and resetFilters drive the list getter', async () => {
    const store = useLibraryStore()
    await store.load()
    store.setSort('title')
    store.setFilter({ genre: 'Action' })
    expect(store.list.map((mv) => mv.id)).toEqual(['b'])
    store.resetFilters()
    expect(store.list).toHaveLength(2)
  })
})

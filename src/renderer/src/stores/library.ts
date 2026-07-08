import { defineStore } from 'pinia'
import type { MovieRecord } from '../../../shared/types'
import {
  EMPTY_FILTERS,
  filterMovies,
  sortMovies,
  type LibraryFilters,
  type SortKey
} from '../lib/filtering'

export const useLibraryStore = defineStore('library', {
  state: () => ({
    movies: {} as Record<string, MovieRecord>,
    filters: { ...EMPTY_FILTERS } as LibraryFilters,
    sort: 'title' as SortKey,
    loaded: false,
    subscribed: false
  }),
  getters: {
    all: (s): MovieRecord[] => Object.values(s.movies),
    list(): MovieRecord[] {
      return sortMovies(filterMovies(this.all, this.filters), this.sort)
    },
    pendingCount(): number {
      return this.all.filter((m) => m.matchStatus === 'pending').length
    },
    allGenres(): string[] {
      return [...new Set(this.all.flatMap((m) => m.genres))].sort()
    },
    allActors(): string[] {
      return [...new Set(this.all.flatMap((m) => m.cast.map((c) => c.name)))].sort()
    },
    allYears(): number[] {
      return [
        ...new Set(
          this.all.map((m) => m.year ?? m.parsedYear).filter((y): y is number => y != null)
        )
      ].sort((a, b) => b - a)
    },
    allCertifications(): string[] {
      return [
        ...new Set(this.all.map((m) => m.certificationAu).filter((c): c is string => c != null))
      ].sort()
    }
  },
  actions: {
    async load() {
      if (!this.subscribed) {
        window.api.onMovieUpdated((m) => this.applyUpdate(m))
        this.subscribed = true
      }
      if (this.loaded) return
      const movies = await window.api.loadLibrary()
      for (const m of movies) this.movies[m.id] = m
      this.loaded = true
    },
    applyUpdate(m: MovieRecord) {
      this.movies[m.id] = m
    },
    setFilter(patch: Partial<LibraryFilters>) {
      this.filters = { ...this.filters, ...patch }
    },
    resetFilters() {
      this.filters = { ...EMPTY_FILTERS }
    },
    setSort(key: SortKey) {
      this.sort = key
    }
  }
})

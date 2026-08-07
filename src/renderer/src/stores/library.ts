import { defineStore } from 'pinia'
import type { MovieRecord, ScanProgress } from '../../../shared/types'
import {
  continueWatchingMovies,
  EMPTY_FILTERS,
  filterMovies,
  filtersAreActive,
  normalizeCertification,
  sortMovies,
  type LibraryFilters,
  type SortKey
} from '../lib/filtering'

export const useLibraryStore = defineStore('library', {
  state: () => ({
    movies: {} as Record<string, MovieRecord>,
    // Fresh certification array — never share EMPTY_FILTERS.certification by reference.
    filters: { ...EMPTY_FILTERS, certification: [] as string[] } as LibraryFilters,
    sort: 'title' as SortKey,
    loaded: false,
    subscribed: false,
    firstViewFromCache: false,
    backgroundScanRunning: false,
    unavailableFolders: [] as string[],
    scanningFolders: {} as Record<string, boolean>
  }),
  getters: {
    all: (s): MovieRecord[] => Object.values(s.movies),
    list(): MovieRecord[] {
      return sortMovies(filterMovies(this.all, this.filters), this.sort)
    },
    continueWatching(): MovieRecord[] {
      return continueWatchingMovies(this.all)
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
        ...new Set(
          this.all
            .map((m) => m.certificationAu)
            .filter((c): c is string => c != null)
            .map(normalizeCertification)
        )
      ].sort()
    },
    hasActiveFilters(): boolean {
      return filtersAreActive(this.filters)
    },
    cacheStatusMessage(): string | null {
      if (!this.firstViewFromCache || this.all.length === 0) return null
      if (this.unavailableFolders.length > 0) {
        return 'Showing cached library. Some movie folders are offline; reconnect Google Drive to refresh.'
      }
      if (this.backgroundScanRunning) {
        return 'Showing cached library while Movie World checks your folders in the background.'
      }
      return null
    }
  },
  actions: {
    async load() {
      if (!this.subscribed) {
        window.api.onMovieUpdated((m) => this.applyUpdate(m))
        window.api.onMovieRemoved((id) => this.applyRemove(id))
        window.api.onScanProgress((p) => this.applyScanProgress(p))
        this.subscribed = true
      }
      if (this.loaded) return
      const result = await window.api.loadLibrary()
      for (const m of result.movies) this.movies[m.id] = m
      this.firstViewFromCache = result.status.firstViewFromCache
      this.backgroundScanRunning = result.status.backgroundScanRunning
      this.unavailableFolders = result.status.unavailableFolders
      this.scanningFolders = Object.fromEntries(
        (result.status.backgroundScanFolders ?? []).map((folder) => [folder, true])
      )
      this.loaded = true
    },
    applyUpdate(m: MovieRecord) {
      this.movies[m.id] = m
    },
    applyRemove(id: string) {
      const next = { ...this.movies }
      delete next[id]
      this.movies = next
    },
    applyScanProgress(p: ScanProgress) {
      const scanningFolders = { ...this.scanningFolders }
      if (p.done) delete scanningFolders[p.folder]
      else scanningFolders[p.folder] = true
      this.scanningFolders = scanningFolders
      this.backgroundScanRunning = Object.values(scanningFolders).some(Boolean)

      const unavailable = new Set(this.unavailableFolders)
      if (p.unavailable) unavailable.add(p.folder)
      else if (!p.done || p.discovered > 0) unavailable.delete(p.folder)
      this.unavailableFolders = [...unavailable].sort()
    },
    setFilter(patch: Partial<LibraryFilters>) {
      this.filters = { ...this.filters, ...patch }
    },
    resetFilters() {
      this.filters = { ...EMPTY_FILTERS, certification: [] }
    },
    setSort(key: SortKey) {
      this.sort = key
    }
  }
})

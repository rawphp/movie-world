import type { Keybindings, MovieRecord, ScanProgress, Settings } from '../shared/types'
import type { TmdbSearchResult } from '../main/tmdb/client'

declare global {
  interface Window {
    api: {
      getSettings(): Promise<Settings>
      setApiKey(key: string): Promise<Settings>
      setKeybindings(kb: Keybindings): Promise<Settings>
      addFolder(): Promise<Settings | null>
      removeFolder(path: string): Promise<Settings>
      loadLibrary(): Promise<MovieRecord[]>
      rescanFolder(folder: string): Promise<void>
      play(id: string): Promise<void>
      retryFetch(id: string): Promise<void>
      fixMatch(id: string, tmdbId: number): Promise<void>
      searchTmdb(query: string, year: number | null): Promise<TmdbSearchResult[]>
      revealFile(id: string): Promise<void>
      onMovieUpdated(cb: (m: MovieRecord) => void): void
      onScanProgress(cb: (p: ScanProgress) => void): void
    }
  }
}

export {}

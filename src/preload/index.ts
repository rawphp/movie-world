import { contextBridge, ipcRenderer } from 'electron'
import type { Keybindings, LibraryLoadResult } from '../shared/types'

const api = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setApiKey: (key: string) => ipcRenderer.invoke('settings:set-api-key', key),
  setKeybindings: (kb: Keybindings) => ipcRenderer.invoke('settings:set-keybindings', kb),
  addFolder: () => ipcRenderer.invoke('folders:add'),
  removeFolder: (path: string) => ipcRenderer.invoke('folders:remove', path),
  loadLibrary: (): Promise<LibraryLoadResult> => ipcRenderer.invoke('library:load'),
  rescanFolder: (folder: string) => ipcRenderer.invoke('library:rescan', folder),
  play: (id: string) => ipcRenderer.invoke('movie:play', id),
  retryFetch: (id: string) => ipcRenderer.invoke('movie:retry-fetch', id),
  fixMatch: (id: string, tmdbId: number) => ipcRenderer.invoke('movie:fix-match', id, tmdbId),
  searchTmdb: (query: string, year: number | null) =>
    ipcRenderer.invoke('tmdb:search', query, year),
  revealFile: (id: string) => ipcRenderer.invoke('file:reveal', id),
  onMovieUpdated: (cb: (m: unknown) => void) => ipcRenderer.on('movie:updated', (_e, m) => cb(m)),
  onScanProgress: (cb: (p: unknown) => void) => ipcRenderer.on('scan:progress', (_e, p) => cb(p))
}

contextBridge.exposeInMainWorld('api', api)

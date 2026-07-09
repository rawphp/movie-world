import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { SettingsStore } from './settings'
import type { LibraryManager } from './library/manager'
import { createTmdbClient } from './tmdb/client'
import type { Keybindings } from '../shared/types'

/**
 * Register the server side of every `window.api` method. Each handler is a thin
 * delegation to the settings store, library manager or TMDB client — no business
 * logic lives here. Channel names are the contract REQ-012's preload depends on.
 */
export function registerIpc(settings: SettingsStore, manager: LibraryManager): void {
  ipcMain.handle('settings:get', () => settings.read())
  ipcMain.handle('settings:set-api-key', (_e, key: string) => settings.setApiKey(key))
  ipcMain.handle('settings:set-keybindings', (_e, kb: Keybindings) => settings.setKeybindings(kb))

  ipcMain.handle('folders:add', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || !result.filePaths[0]) return null
    const next = settings.addFolder(result.filePaths[0])
    void manager.rescanFolder(result.filePaths[0])
    return next
  })
  ipcMain.handle('folders:remove', (_e, path: string) => settings.removeFolder(path))

  ipcMain.handle('library:load', () => manager.loadLibrary())
  ipcMain.handle('library:rescan', (_e, folder: string) => manager.rescanFolder(folder))
  ipcMain.handle('movie:play', (_e, id: string) => manager.play(id))
  ipcMain.handle('movie:retry-fetch', (_e, id: string) => manager.retryFetch(id))
  ipcMain.handle('movie:fix-match', (_e, id: string, tmdbId: number) =>
    manager.fixMatch(id, tmdbId)
  )

  ipcMain.handle('tmdb:search', (_e, query: string, year: number | null) => {
    const key = settings.read().tmdbApiKey
    if (!key) return []
    return createTmdbClient(key).searchMovies(query, year)
  })

  ipcMain.handle('file:reveal', (_e, id: string) => {
    const movie = manager.getMovies().find((m) => m.id === id)
    if (movie) shell.showItemInFolder(movie.filePath)
  })
}

/** Broadcast a manager event to every open renderer on the given channel. */
export function emitToAll(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, payload)
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Keybindings } from '../../shared/types'

const invoke = vi.fn()
const exposeInMainWorld = vi.fn()

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke }
}))

describe('preload api bridge', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('exposes setKeybindings through the settings IPC channel', async () => {
    await import('../index')

    const api = exposeInMainWorld.mock.calls[0]?.[1]
    const keybindings: Keybindings = {
      prevMovie: 'Alt+[',
      nextMovie: 'Alt+]'
    }

    await api.setKeybindings(keybindings)

    expect(invoke).toHaveBeenCalledWith('settings:set-keybindings', keybindings)
  })

  it('exposes cached-first library loading through the library IPC channel', async () => {
    const payload = {
      movies: [],
      status: {
        firstViewFromCache: false,
        backgroundScanRunning: false,
        unavailableFolders: []
      }
    }
    invoke.mockResolvedValueOnce(payload)
    await import('../index')

    const api = exposeInMainWorld.mock.calls[0]?.[1]

    await expect(api.loadLibrary()).resolves.toEqual(payload)
    expect(invoke).toHaveBeenCalledWith('library:load')
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_KEYBINDINGS } from '../../shared/keybindings'
import type { Keybindings } from '../../shared/types'
import type { LibraryManager } from '../library/manager'
import { createSettingsStore } from '../settings'
import type { SettingsStore } from '../settings'

const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    })
  },
  shell: { showItemInFolder: vi.fn() }
}))

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mw-settings-'))
  return () => rmSync(dir, { recursive: true, force: true })
})

describe('settings store', () => {
  it('returns defaults when file does not exist', () => {
    const s = createSettingsStore(join(dir, 'settings.json'))
    expect(s.read()).toEqual({ folders: [], tmdbApiKey: null, keybindings: DEFAULT_KEYBINDINGS })
  })

  it('deep-merges keybinding defaults from legacy and partial settings files', () => {
    const missingFile = join(dir, 'missing-keybindings.json')
    writeFileSync(missingFile, JSON.stringify({ folders: ['/Movies'], tmdbApiKey: null }))

    expect(createSettingsStore(missingFile).read().keybindings).toEqual(DEFAULT_KEYBINDINGS)

    const partialFile = join(dir, 'partial-keybindings.json')
    writeFileSync(
      partialFile,
      JSON.stringify({ keybindings: { prevMovie: 'Alt+[' }, folders: [], tmdbApiKey: null })
    )

    expect(createSettingsStore(partialFile).read().keybindings).toEqual({
      prevMovie: 'Alt+[',
      nextMovie: DEFAULT_KEYBINDINGS.nextMovie
    })
  })

  it('persists api key and folders across instances', () => {
    const file = join(dir, 'settings.json')
    const a = createSettingsStore(file)
    a.setApiKey('k123')
    a.addFolder('/Movies')
    a.addFolder('/Movies') // dedupe
    a.addFolder('/More')
    a.removeFolder('/More')
    const b = createSettingsStore(file)
    expect(b.read()).toEqual({
      folders: ['/Movies'],
      tmdbApiKey: 'k123',
      keybindings: DEFAULT_KEYBINDINGS
    })
  })

  it('persists keybindings across instances', () => {
    const file = join(dir, 'settings.json')
    const a = createSettingsStore(file)

    expect(a.setKeybindings({ prevMovie: 'Alt+[', nextMovie: 'Alt+]' })).toMatchObject({
      keybindings: { prevMovie: 'Alt+[', nextMovie: 'Alt+]' }
    })

    expect(createSettingsStore(file).read().keybindings).toEqual({
      prevMovie: 'Alt+[',
      nextMovie: 'Alt+]'
    })
  })

  it('rejects invalid or duplicate keybindings without changing the file', () => {
    const file = join(dir, 'settings.json')
    const s = createSettingsStore(file)
    s.setKeybindings({ prevMovie: 'Alt+[', nextMovie: 'Alt+]' })
    const before = readFileSync(file, 'utf8')

    expect(() => s.setKeybindings({ prevMovie: '', nextMovie: 'Alt+]' })).toThrow(Error)
    expect(readFileSync(file, 'utf8')).toBe(before)

    expect(() => s.setKeybindings({ prevMovie: 'Alt+[', nextMovie: 'Escape' })).toThrow(Error)
    expect(readFileSync(file, 'utf8')).toBe(before)

    expect(() => s.setKeybindings({ prevMovie: 'Alt+[', nextMovie: 'Alt+[' })).toThrow(Error)
    expect(readFileSync(file, 'utf8')).toBe(before)
  })
})

describe('settings IPC', () => {
  it('registers settings:set-keybindings and delegates to the settings store', async () => {
    const { registerIpc } = await import('../ipc')
    const kb: Keybindings = { prevMovie: 'Alt+[', nextMovie: 'Alt+]' }
    const settings = {
      read: vi.fn(),
      setApiKey: vi.fn(),
      setKeybindings: vi.fn(() => ({ folders: [], tmdbApiKey: null, keybindings: kb })),
      addFolder: vi.fn(),
      removeFolder: vi.fn()
    } satisfies SettingsStore
    const manager = {
      loadLibrary: vi.fn(),
      rescanFolder: vi.fn(),
      play: vi.fn(),
      retryFetch: vi.fn(),
      fixMatch: vi.fn(),
      getMovies: vi.fn(() => [])
    } as unknown as LibraryManager

    registerIpc(settings, manager)
    const result = handlers.get('settings:set-keybindings')?.({}, kb)

    expect(settings.setKeybindings).toHaveBeenCalledWith(kb)
    expect(result).toEqual({ folders: [], tmdbApiKey: null, keybindings: kb })
  })
})

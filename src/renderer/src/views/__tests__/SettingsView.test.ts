// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SettingsView from '../SettingsView.vue'
import { DEFAULT_KEYBINDINGS } from '../../../../shared/keybindings'
import type { ScanProgress, Settings } from '../../../../shared/types'

type ProgressCb = (p: ScanProgress) => void
let progressCb: ProgressCb | null = null

const makeApi = (initial: Settings): void => {
  progressCb = null
  // Assign only window.api so jsdom's Event constructors (needed by trigger) survive.
  window.api = {
    getSettings: vi.fn(async () => initial),
    setApiKey: vi.fn(async (k: string) => ({
      folders: initial.folders,
      tmdbApiKey: k,
      keybindings: initial.keybindings
    })),
    setKeybindings: vi.fn(async (kb) => ({
      folders: initial.folders,
      tmdbApiKey: initial.tmdbApiKey,
      keybindings: kb
    })),
    addFolder: vi.fn(async () => ({
      folders: [...initial.folders, '/More'],
      tmdbApiKey: initial.tmdbApiKey,
      keybindings: initial.keybindings
    })),
    removeFolder: vi.fn(async () => ({
      folders: [],
      tmdbApiKey: initial.tmdbApiKey,
      keybindings: initial.keybindings
    })),
    rescanFolder: vi.fn(async () => {}),
    onScanProgress: vi.fn((cb: ProgressCb) => {
      progressCb = cb
    })
  } as unknown as Window['api']
}

beforeEach(() => {
  makeApi({ folders: ['/Movies'], tmdbApiKey: null, keybindings: DEFAULT_KEYBINDINGS })
})

describe('SettingsView', () => {
  it('lists registered folders and saves the api key', async () => {
    const w = mount(SettingsView)
    await flushPromises()
    expect(w.find('[data-testid="folder-row"]').text()).toContain('Movies')
    expect(w.find('[data-testid="folder-row"]').attributes('title') || w.html()).toContain('Movies')

    await w.find('[data-testid="apikey-input"]').setValue('NEWKEY')
    await w.find('[data-testid="apikey-save"]').trigger('click')
    await flushPromises()
    expect(window.api.setApiKey).toHaveBeenCalledWith('NEWKEY')
    // Reflects a saved result after a successful save.
    expect(w.find('[data-testid="apikey-save"]').text()).not.toBe('')
    expect(w.get('[data-testid="apikey-status"]').text().toLowerCase()).toContain('saved')
  })

  it('adds a folder via the native dialog and can rescan it', async () => {
    const w = mount(SettingsView)
    await flushPromises()

    await w.find('[data-testid="folder-add"]').trigger('click')
    await flushPromises()
    expect(window.api.addFolder).toHaveBeenCalled()
    expect(w.findAll('[data-testid="folder-row"]')).toHaveLength(2)

    await w.findAll('[data-testid="folder-rescan"]')[0].trigger('click')
    expect(window.api.rescanFolder).toHaveBeenCalledWith('/Movies')
  })

  it('shows streamed scan progress for a folder', async () => {
    const w = mount(SettingsView)
    await flushPromises()
    expect(window.api.onScanProgress).toHaveBeenCalled()
    expect(progressCb).toBeTypeOf('function')

    progressCb?.({ folder: '/Movies', discovered: 10, ingested: 4, done: false })
    await flushPromises()
    expect(w.find('[data-testid="folder-row"]').text()).toContain('4')
    expect(w.find('[data-testid="folder-row"]').text()).toContain('10')
  })

  it('removes a folder (forget only) via removeFolder after confirm', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const w = mount(SettingsView)
    await flushPromises()
    await w.find('[data-testid="folder-remove"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalled()
    expect(window.api.removeFolder).toHaveBeenCalledWith('/Movies')
    expect(w.findAll('[data-testid="folder-row"]')).toHaveLength(0)
    confirm.mockRestore()
  })

  it('keeps the folder when remove is cancelled', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const w = mount(SettingsView)
    await flushPromises()
    await w.find('[data-testid="folder-remove"]').trigger('click')
    await flushPromises()
    expect(window.api.removeFolder).not.toHaveBeenCalled()
    expect(w.findAll('[data-testid="folder-row"]')).toHaveLength(1)
    confirm.mockRestore()
  })

  it('shows the first-run guided empty state when no key and no folders', async () => {
    makeApi({ folders: [], tmdbApiKey: null, keybindings: DEFAULT_KEYBINDINGS })
    const w = mount(SettingsView)
    await flushPromises()
    expect(w.find('[data-testid="first-run"]').exists()).toBe(true)
    // Still exposes the key + add-folder affordances so the user can get started.
    expect(w.find('[data-testid="apikey-input"]').exists()).toBe(true)
    expect(w.find('[data-testid="folder-add"]').exists()).toBe(true)
    expect(w.findAll('[data-testid="folder-row"]')).toHaveLength(0)
  })

  it('hides the first-run state once a folder exists', async () => {
    const w = mount(SettingsView)
    await flushPromises()
    expect(w.find('[data-testid="first-run"]').exists()).toBe(false)
  })

  it('renders keyboard shortcut recorders from settings', async () => {
    makeApi({
      folders: ['/Movies'],
      tmdbApiKey: null,
      keybindings: { prevMovie: 'Alt+p', nextMovie: 'Alt+n' }
    })

    const w = mount(SettingsView)
    await flushPromises()

    expect(w.get('[data-testid="keyboard-shortcuts"]').text()).toContain('Keyboard shortcuts')
    expect(w.get('[data-testid="shortcut-prev"]').text()).toContain('Alt + p')
    expect(w.get('[data-testid="shortcut-next"]').text()).toContain('Alt + n')
  })

  it('persists a recorded valid shortcut and updates the chip', async () => {
    const w = mount(SettingsView)
    await flushPromises()

    await w.get('[data-testid="shortcut-next"] [data-testid="shortcut-recorder"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', altKey: true, cancelable: true }))
    await flushPromises()

    expect(window.api.setKeybindings).toHaveBeenCalledWith({
      prevMovie: DEFAULT_KEYBINDINGS.prevMovie,
      nextMovie: 'Alt+n'
    })
    expect(w.get('[data-testid="shortcut-next"]').text()).toContain('Alt + n')
  })

  it('rejects duplicate shortcuts without persisting', async () => {
    makeApi({
      folders: ['/Movies'],
      tmdbApiKey: null,
      keybindings: { prevMovie: 'Alt+p', nextMovie: 'Alt+n' }
    })
    const w = mount(SettingsView)
    await flushPromises()

    await w.get('[data-testid="shortcut-next"] [data-testid="shortcut-recorder"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', altKey: true, cancelable: true }))
    await flushPromises()

    expect(window.api.setKeybindings).not.toHaveBeenCalled()
    expect(w.get('[data-testid="shortcut-next"]').text()).toContain('Already used')
    expect(w.get('[data-testid="shortcut-next"]').text()).toContain('Alt + n')
  })

  it('resets shortcuts to defaults', async () => {
    makeApi({
      folders: ['/Movies'],
      tmdbApiKey: null,
      keybindings: { prevMovie: 'Alt+p', nextMovie: 'Alt+n' }
    })
    const w = mount(SettingsView)
    await flushPromises()

    await w.get('[data-testid="shortcut-reset"]').trigger('click')
    await flushPromises()

    expect(window.api.setKeybindings).toHaveBeenCalledWith(DEFAULT_KEYBINDINGS)
    expect(w.get('[data-testid="shortcut-prev"]').text()).toContain('←')
    expect(w.get('[data-testid="shortcut-next"]').text()).toContain('→')
  })
})

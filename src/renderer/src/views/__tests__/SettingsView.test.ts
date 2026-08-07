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

  it('hides the first-run welcome once a folder exists', async () => {
    const w = mount(SettingsView)
    await flushPromises()
    expect(w.find('[data-testid="first-run"]').exists()).toBe(false)
  })

  it('shows setup progress with both steps remaining on first run', async () => {
    makeApi({ folders: [], tmdbApiKey: null, keybindings: DEFAULT_KEYBINDINGS })
    const w = mount(SettingsView)
    await flushPromises()
    const panel = w.get('[data-testid="setup-progress"]')
    expect(panel.exists()).toBe(true)
    expect(w.get('[data-testid="setup-step-key"]').attributes('data-done')).toBe('false')
    expect(w.get('[data-testid="setup-step-folder"]').attributes('data-done')).toBe('false')
  })

  it('marks API key done and folder remaining when key exists but no folders', async () => {
    makeApi({ folders: [], tmdbApiKey: 'k', keybindings: DEFAULT_KEYBINDINGS })
    const w = mount(SettingsView)
    await flushPromises()
    expect(w.get('[data-testid="setup-progress"]').exists()).toBe(true)
    expect(w.get('[data-testid="setup-step-key"]').attributes('data-done')).toBe('true')
    expect(w.get('[data-testid="setup-step-folder"]').attributes('data-done')).toBe('false')
    expect(w.find('[data-testid="first-run"]').exists()).toBe(false)
  })

  it('marks folder done and API key remaining when folders exist but no key', async () => {
    makeApi({ folders: ['/Movies'], tmdbApiKey: null, keybindings: DEFAULT_KEYBINDINGS })
    const w = mount(SettingsView)
    await flushPromises()
    expect(w.get('[data-testid="setup-progress"]').exists()).toBe(true)
    expect(w.get('[data-testid="setup-step-key"]').attributes('data-done')).toBe('false')
    expect(w.get('[data-testid="setup-step-folder"]').attributes('data-done')).toBe('true')
  })

  it('hides setup progress when both key and folders are configured', async () => {
    makeApi({
      folders: ['/Movies'],
      tmdbApiKey: 'existing-key',
      keybindings: DEFAULT_KEYBINDINGS
    })
    const w = mount(SettingsView)
    await flushPromises()
    expect(w.find('[data-testid="setup-progress"]').exists()).toBe(false)
  })

  it('updates setup progress after saving a key with no folders yet', async () => {
    makeApi({ folders: [], tmdbApiKey: null, keybindings: DEFAULT_KEYBINDINGS })
    const w = mount(SettingsView)
    await flushPromises()
    expect(w.get('[data-testid="setup-step-key"]').attributes('data-done')).toBe('false')

    await w.find('[data-testid="apikey-input"]').setValue('NEWKEY')
    await w.find('[data-testid="apikey-save"]').trigger('click')
    await flushPromises()

    expect(w.get('[data-testid="apikey-status"]').text().toLowerCase()).toContain('saved')
    expect(w.get('[data-testid="setup-step-key"]').attributes('data-done')).toBe('true')
    expect(w.get('[data-testid="setup-step-folder"]').attributes('data-done')).toBe('false')
  })

  it('explains free TMDB key purpose and deep-links to API settings', async () => {
    const w = mount(SettingsView)
    await flushPromises()
    const help = w.get('[data-testid="tmdb-key-help"]')
    const text = help.text().toLowerCase()
    expect(text).toMatch(/free/)
    expect(text).toMatch(/poster|metadata|detail/)
    const link = help.get('a')
    expect(link.attributes('href')).toBe('https://www.themoviedb.org/settings/api')
    expect(link.attributes('target')).toBe('_blank')
  })

  it('shows scanning feedback on a folder when progress events fire after add', async () => {
    makeApi({ folders: [], tmdbApiKey: 'k', keybindings: DEFAULT_KEYBINDINGS })
    // addFolder returns a folder path that can receive progress
    window.api.addFolder = vi.fn(async () => ({
      folders: ['/NewMovies'],
      tmdbApiKey: 'k',
      keybindings: DEFAULT_KEYBINDINGS
    }))
    const w = mount(SettingsView)
    await flushPromises()

    await w.find('[data-testid="folder-add"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="folder-row"]').text()).toContain('NewMovies')

    progressCb?.({ folder: '/NewMovies', discovered: 5, ingested: 2, done: false })
    await flushPromises()
    const row = w.find('[data-testid="folder-row"]')
    expect(row.text()).toMatch(/scanning/i)
    expect(row.text()).toContain('2')
    expect(row.text()).toContain('5')
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

  it('resets shortcuts to defaults after confirm', async () => {
    makeApi({
      folders: ['/Movies'],
      tmdbApiKey: null,
      keybindings: { prevMovie: 'Alt+p', nextMovie: 'Alt+n' }
    })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const w = mount(SettingsView)
    await flushPromises()

    await w.get('[data-testid="shortcut-reset"]').trigger('click')
    await flushPromises()

    expect(confirm).toHaveBeenCalled()
    expect(window.api.setKeybindings).toHaveBeenCalledWith(DEFAULT_KEYBINDINGS)
    expect(w.get('[data-testid="shortcut-prev"]').text()).toContain('←')
    expect(w.get('[data-testid="shortcut-next"]').text()).toContain('→')
    confirm.mockRestore()
  })

  it('does not reset shortcuts when confirm is cancelled', async () => {
    makeApi({
      folders: ['/Movies'],
      tmdbApiKey: null,
      keybindings: { prevMovie: 'Alt+p', nextMovie: 'Alt+n' }
    })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const w = mount(SettingsView)
    await flushPromises()

    await w.get('[data-testid="shortcut-reset"]').trigger('click')
    await flushPromises()

    expect(window.api.setKeybindings).not.toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('shows that an existing API key is already set on load', async () => {
    makeApi({
      folders: ['/Movies'],
      tmdbApiKey: 'existing-key',
      keybindings: DEFAULT_KEYBINDINGS
    })
    const w = mount(SettingsView)
    await flushPromises()
    expect(w.get('[data-testid="apikey-status"]').text()).toContain('Key is set')
    expect(w.find('[data-testid="apikey-toggle"]').exists()).toBe(true)
  })

  it('uses Settings as the page heading', async () => {
    const w = mount(SettingsView)
    await flushPromises()
    expect(w.get('h1').text()).toBe('Settings')
  })
})

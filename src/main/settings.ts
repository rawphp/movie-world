import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { DEFAULT_KEYBINDINGS, isValidCombo } from '../shared/keybindings'
import type { Keybindings, Settings } from '../shared/types'

const DEFAULTS: Settings = { folders: [], tmdbApiKey: null, keybindings: DEFAULT_KEYBINDINGS }

export interface SettingsStore {
  read(): Settings
  setApiKey(key: string): Settings
  setKeybindings(kb: Keybindings): Settings
  addFolder(path: string): Settings
  removeFolder(path: string): Settings
}

export function createSettingsStore(file: string): SettingsStore {
  function read(): Settings {
    if (!existsSync(file)) return { ...DEFAULTS }
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<Settings>
    return {
      ...DEFAULTS,
      ...parsed,
      keybindings: { ...DEFAULTS.keybindings, ...parsed.keybindings }
    }
  }
  function write(patch: Partial<Settings>): Settings {
    const next = { ...read(), ...patch }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(next, null, 2))
    return next
  }
  function setKeybindings(kb: Keybindings): Settings {
    if (
      !isValidCombo(kb.prevMovie) ||
      !isValidCombo(kb.nextMovie) ||
      kb.prevMovie === kb.nextMovie
    ) {
      throw new Error('Invalid keybindings')
    }

    return write({ keybindings: kb })
  }
  return {
    read,
    setApiKey: (key: string) => write({ tmdbApiKey: key }),
    setKeybindings,
    addFolder: (path: string) => write({ folders: [...new Set([...read().folders, path])] }),
    removeFolder: (path: string) => write({ folders: read().folders.filter((f) => f !== path) })
  }
}

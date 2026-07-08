import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Settings } from '../shared/types'

const DEFAULTS: Settings = { folders: [], tmdbApiKey: null }

export interface SettingsStore {
  read(): Settings
  setApiKey(key: string): Settings
  addFolder(path: string): Settings
  removeFolder(path: string): Settings
}

export function createSettingsStore(file: string): SettingsStore {
  function read(): Settings {
    if (!existsSync(file)) return { ...DEFAULTS }
    return { ...DEFAULTS, ...(JSON.parse(readFileSync(file, 'utf8')) as Partial<Settings>) }
  }
  function write(patch: Partial<Settings>): Settings {
    const next = { ...read(), ...patch }
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(next, null, 2))
    return next
  }
  return {
    read,
    setApiKey: (key: string) => write({ tmdbApiKey: key }),
    addFolder: (path: string) => write({ folders: [...new Set([...read().folders, path])] }),
    removeFolder: (path: string) => write({ folders: read().folders.filter((f) => f !== path) })
  }
}

import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_KEYBINDINGS } from '../../shared/keybindings'
import { createSettingsStore } from '../settings'

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
})

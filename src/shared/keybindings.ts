import type { Keybindings } from './types'

const MODIFIERS = ['Mod', 'Ctrl', 'Alt', 'Shift'] as const
const MODIFIER_KEYS = new Set(['Alt', 'Control', 'Ctrl', 'Meta', 'Mod', 'Shift'])
const RESERVED_BARE_KEYS = new Set(['Escape', 'Tab'])
const RESERVED_MOD_KEYS = new Set(['q', 'w'])

type Modifier = (typeof MODIFIERS)[number]

interface ParsedCombo {
  modifiers: Set<Modifier>
  key: string
}

export const DEFAULT_KEYBINDINGS: Keybindings = {
  prevMovie: 'Mod+ArrowLeft',
  nextMovie: 'Mod+ArrowRight'
}

export function comboFromEvent(e: KeyboardEvent, isMac: boolean): string | null {
  if (MODIFIER_KEYS.has(e.key)) {
    return null
  }

  const modifiers: Modifier[] = []

  if (isMac && e.metaKey) {
    modifiers.push('Mod')
  }

  if (e.ctrlKey) {
    modifiers.push('Ctrl')
  }

  if (e.altKey) {
    modifiers.push('Alt')
  }

  if (e.shiftKey) {
    modifiers.push('Shift')
  }

  return [...modifiers, e.key].join('+')
}

export function matchesCombo(e: KeyboardEvent, combo: string, isMac: boolean): boolean {
  const parsed = parseCombo(combo)

  if (!parsed || e.key !== parsed.key) {
    return false
  }

  return (
    e.metaKey === (isMac && parsed.modifiers.has('Mod')) &&
    e.ctrlKey === (parsed.modifiers.has('Ctrl') || (!isMac && parsed.modifiers.has('Mod'))) &&
    e.altKey === parsed.modifiers.has('Alt') &&
    e.shiftKey === parsed.modifiers.has('Shift')
  )
}

export function isValidCombo(combo: string): boolean {
  const parsed = parseCombo(combo)

  if (!parsed || RESERVED_BARE_KEYS.has(parsed.key)) {
    return false
  }

  if (
    parsed.modifiers.size === 1 &&
    parsed.modifiers.has('Mod') &&
    RESERVED_MOD_KEYS.has(parsed.key.toLowerCase())
  ) {
    return false
  }

  return true
}

function parseCombo(combo: string): ParsedCombo | null {
  const parts = combo.split('+')
  const key = parts.at(-1)

  if (!key || MODIFIER_KEYS.has(key)) {
    return null
  }

  const modifiers = new Set<Modifier>()
  let previousIndex = -1

  for (const part of parts.slice(0, -1)) {
    const modifierIndex = MODIFIERS.indexOf(part as Modifier)

    if (modifierIndex === -1 || modifierIndex <= previousIndex || modifiers.has(part as Modifier)) {
      return null
    }

    modifiers.add(part as Modifier)
    previousIndex = modifierIndex
  }

  return { modifiers, key }
}

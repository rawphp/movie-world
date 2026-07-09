import { describe, expect, it } from 'vitest'
import { DEFAULT_KEYBINDINGS, comboFromEvent, isValidCombo, matchesCombo } from '../keybindings'

function keyEvent(
  key: string,
  modifiers: Partial<Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>> = {}
): KeyboardEvent {
  return {
    key,
    altKey: modifiers.altKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    shiftKey: modifiers.shiftKey ?? false
  } as KeyboardEvent
}

describe('keybinding utilities', () => {
  it('defines platform-neutral defaults for detail navigation', () => {
    expect(DEFAULT_KEYBINDINGS).toEqual({
      prevMovie: 'Mod+ArrowLeft',
      nextMovie: 'Mod+ArrowRight'
    })
  })

  it('matches Mod to Meta on macOS and Ctrl elsewhere', () => {
    expect(matchesCombo(keyEvent('ArrowRight', { metaKey: true }), 'Mod+ArrowRight', true)).toBe(
      true
    )
    expect(matchesCombo(keyEvent('ArrowRight', { metaKey: true }), 'Mod+ArrowRight', false)).toBe(
      false
    )
    expect(matchesCombo(keyEvent('ArrowRight', { ctrlKey: true }), 'Mod+ArrowRight', false)).toBe(
      true
    )
  })

  it('rejects events with extra modifiers held', () => {
    expect(
      matchesCombo(
        keyEvent('ArrowRight', { metaKey: true, shiftKey: true }),
        'Mod+ArrowRight',
        true
      )
    ).toBe(false)
  })

  it('serializes keydown events with ordered modifiers and ignores modifier-only presses', () => {
    expect(comboFromEvent(keyEvent('Meta'), true)).toBeNull()
    expect(comboFromEvent(keyEvent('p', { ctrlKey: true, shiftKey: true }), false)).toBe(
      'Ctrl+Shift+p'
    )
  })

  it('validates usable combos and rejects empty, modifier-only, and reserved combos', () => {
    expect(isValidCombo('')).toBe(false)
    expect(isValidCombo('Mod')).toBe(false)
    expect(isValidCombo('Escape')).toBe(false)
    expect(isValidCombo('Tab')).toBe(false)
    expect(isValidCombo('Mod+q')).toBe(false)
    expect(isValidCombo('Mod+w')).toBe(false)
    expect(isValidCombo('Mod+ArrowLeft')).toBe(true)
    expect(isValidCombo(']')).toBe(true)
  })
})

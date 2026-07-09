# REQ-024: Shared keybinding types, defaults and combo util

**UR:** UR-006
**Status:** backlog
**Created:** 2026-07-09
**Layer:** shared
**Entry point:**
**Terminal state:**
**Parent:** REQ-023
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 3
**Size:** M
**Files:** src/shared/types.ts, src/shared/keybindings.ts, src/shared/__tests__/keybindings.test.ts
**Depends on:**

## Task

Extend the shared domain layer with keybinding support:

1. In `src/shared/types.ts`, add a `Keybindings` interface (`{ prevMovie: string; nextMovie: string }`) and extend `Settings` with a `keybindings: Keybindings` field.
2. Create `src/shared/keybindings.ts` with:
   - `DEFAULT_KEYBINDINGS: Keybindings = { prevMovie: 'Mod+ArrowLeft', nextMovie: 'Mod+ArrowRight' }` — `Mod` means the Meta (Cmd) key on macOS and Ctrl elsewhere.
   - Combo string format: ordered modifiers (`Mod`, `Ctrl`, `Alt`, `Shift`) joined with `+` and terminated by a `KeyboardEvent.key` value (e.g. `Mod+ArrowRight`, `Alt+Shift+n`, `]`).
   - `comboFromEvent(e: KeyboardEvent, isMac: boolean): string | null` — serializes a keydown into a combo string; returns `null` for modifier-only presses (e.g. bare Cmd) so a recorder ignores them.
   - `matchesCombo(e: KeyboardEvent, combo: string, isMac: boolean): boolean` — true when the event's key + modifier set exactly matches the combo (extra modifiers held ⇒ no match).
   - `isValidCombo(combo: string): boolean` — rejects empty strings, modifier-only combos, and reserved/unusable combos (bare `Escape`, bare `Tab`, `Mod+q`, `Mod+w`).

Platform (`isMac`) is passed as a parameter so both main and renderer can call the util and tests are deterministic.

## Context

Brief requires an editable keyboard combination for previous/next detail-view navigation. Clarified defaults: Cmd/Ctrl+← / Cmd/Ctrl+→. This REQ is the single source of truth for the combo format, defaults, matching and validation — consumed by the main settings store (REQ-027), the detail-view handler (REQ-025) and the settings recorder UI (REQ-029). Placing it in `src/shared/` follows the existing pattern where `Settings` and other domain types live in `src/shared/types.ts` and are imported by every process.

## Acceptance Criteria

- [ ] `Settings` in `src/shared/types.ts` includes `keybindings: Keybindings` and the project still typechecks
- [ ] `matchesCombo` returns true for a `metaKey+ArrowRight` event against `Mod+ArrowRight` when `isMac` is true, and false when `isMac` is false (Ctrl expected instead)
- [ ] `matchesCombo` returns false when extra modifiers are held (e.g. `Shift+Meta+ArrowRight` vs `Mod+ArrowRight`)
- [ ] `comboFromEvent` returns `null` for a modifier-only keydown (e.g. `key === 'Meta'`) and a correctly ordered combo string for `ctrlKey+shiftKey+key 'p'`
- [ ] `isValidCombo` returns false for `''`, `'Mod'`, `'Escape'`, `'Mod+q'`, `'Mod+w'` and true for `'Mod+ArrowLeft'`, `']'`
- [ ] Unit tests in `src/shared/__tests__/keybindings.test.ts` cover all of the above and pass

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/shared/__tests__/keybindings.test.ts`
   - Expected: all keybinding util tests pass
2. **test** `npx vitest run`
   - Expected: full suite still green (Settings type change breaks nothing — handoff: shared type → main/renderer consumers)
3. **build** `npx vue-tsc --noEmit -p tsconfig.web.json 2>/dev/null || npm run typecheck`
   - Expected: zero type errors after extending `Settings`

## Integration

**Reachability:** Library export consumed via existing shared-type imports — `src/main/settings.ts` imports `Settings` from `../shared/types` (line 3), and `src/renderer/src/views/SettingsView.vue` imports `Settings` from `../../../shared/types` (line 3). The new `src/shared/keybindings.ts` module sits beside `src/shared/types.ts` and is imported the same way.

**Data dependencies:** Extends the `Settings` interface at `src/shared/types.ts:42` (currently `folders` + `tmdbApiKey`).

**Service dependencies:** None — pure types and pure functions; no runtime services.

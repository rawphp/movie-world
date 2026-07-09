# REQ-029: Settings shortcut recorder UI

**UR:** UR-006
**Status:** backlog
**Created:** 2026-07-09
**Layer:** renderer
**Entry point:**
**Terminal state:**
**Parent:** REQ-026
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** M
**Files:** src/renderer/src/components/ShortcutRecorder.vue, src/renderer/src/components/__tests__/ShortcutRecorder.test.ts, src/renderer/src/views/SettingsView.vue, src/renderer/src/views/__tests__/SettingsView.test.ts
**Depends on:** REQ-024 REQ-028

## Task

Add a "Keyboard shortcuts" section to SettingsView with a key-capture recorder:

1. Create `src/renderer/src/components/ShortcutRecorder.vue`: shows the current combo as a readable chip (e.g. `⌘ + →` on macOS, `Ctrl + →` elsewhere). Clicking it enters recording mode ("Press a combination… Esc to cancel"): the next keydown is serialized via `comboFromEvent` (modifier-only presses are ignored, `Escape` cancels recording), validated with `isValidCombo`, and emitted; invalid combos show an inline error and stay in recording mode. While recording, the keydown is fully captured (`preventDefault`/`stopPropagation`) so nothing else reacts.
2. In `src/renderer/src/views/SettingsView.vue`, add a "Keyboard shortcuts" section (following the existing section markup style) with two rows — "Previous movie" and "Next movie" — each using `ShortcutRecorder`, plus a "Reset to defaults" button. On a recorded combo: reject duplicates in the UI (new prev == current next or vice versa) with an inline error; otherwise call `await api.setKeybindings(...)` and update local state from the returned `Settings`. Reset calls `setKeybindings(DEFAULT_KEYBINDINGS)`.
3. Load initial values from the existing `api.getSettings()` call in `onMounted` (`settings.value.keybindings`).

## Acceptance Criteria

- [ ] SettingsView renders a "Keyboard shortcuts" section with two recorder rows showing the combos from `getSettings().keybindings`
- [ ] Clicking a recorder and dispatching a valid keydown (e.g. Alt+N) emits/persists the new combo via `api.setKeybindings` and the chip updates to the new combo (component test with stubbed api)
- [ ] Modifier-only keydowns are ignored while recording; `Escape` cancels recording leaving the previous combo intact
- [ ] An invalid combo (per `isValidCombo`) or a duplicate (prev == next) shows an inline error message and does not call `api.setKeybindings`
- [ ] "Reset to defaults" calls `api.setKeybindings` with `DEFAULT_KEYBINDINGS` and the chips show the default combos afterwards
- [ ] While recording, the captured keydown is `preventDefault`ed and does not leak to other handlers

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/renderer/src/components/__tests__/ShortcutRecorder.test.ts`
   - Expected: recording, cancel, ignore-modifier-only and invalid-combo cases pass (handoff: keydown → emitted combo string)
2. **test** `npx vitest run src/renderer/src/views/__tests__/SettingsView.test.ts`
   - Expected: section renders, persist/duplicate/reset cases pass (handoff: emitted combo → api.setKeybindings call)
3. **test** `npx vitest run`
   - Expected: full suite green
4. **build** `npm run build`
   - Expected: clean build, no type errors

## Integration

**Reachability:** New section inside the existing `/settings` route (`src/renderer/src/router.ts:9`), rendered by `src/renderer/src/views/SettingsView.vue` below the "Movie folders" section (`src/renderer/src/views/SettingsView.vue:111`).

**Data dependencies:** Reads `settings.value.keybindings` loaded via `api.getSettings()` in `onMounted` (`src/renderer/src/views/SettingsView.vue:16`); writes through `window.api.setKeybindings` (REQ-028).

**Service dependencies:** Uses `comboFromEvent`, `isValidCombo` and `DEFAULT_KEYBINDINGS` from `src/shared/keybindings.ts` (REQ-024); follows the section + save-state UX patterns already in SettingsView (`keyState` pattern at `src/renderer/src/views/SettingsView.vue:10`).

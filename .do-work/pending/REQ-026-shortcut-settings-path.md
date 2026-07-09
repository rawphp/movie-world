# REQ-026: Editable shortcuts settings path

**UR:** UR-006
**Status:** pending-validation
**Created:** 2026-07-09
**Layer:** none
**Entry point:** User opens `/settings` (SettingsView) and clicks a binding in the new "Keyboard shortcuts" section
**Terminal state:** The recorded combination is persisted to the settings file on disk, returned by `settings:get`, and immediately used by the detail view for prev/next navigation without an app restart
**Parent:**
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 1
**Size:** S
**Files:**
**Depends on:** REQ-027, REQ-028, REQ-029

## Task

Path-unit REQ: owns closure of the shortcut-editing journey. No new code of its own — verify that the pieces built by REQ-027 (main persistence + IPC), REQ-028 (preload bridge) and REQ-029 (recorder UI) integrate into a working end-to-end path from clicking a binding to the new combo being live.

## Context

Brief: "keyboard combination should be editable in settings". Clarified: editing works via a key-capture recorder — click the binding, press the desired combo, it's recorded — validated against duplicates/unusable keys, with a reset-to-default button.

## Acceptance Criteria

- [x] Recording a new combo in SettingsView round-trips: `setKeybindings` IPC persists it, and a subsequent `settings:get` returns the new value
- [x] A settings file written before this feature existed (no `keybindings` key) loads with `DEFAULT_KEYBINDINGS` merged in — no crash, no undefined bindings
- [x] Reset-to-default restores `Mod+ArrowLeft` / `Mod+ArrowRight` both in the UI and on disk
- [x] Full test suite (`npx vitest run`) passes with all three child REQs merged

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run`
   - Expected: entire suite green, including new settings-store, recorder-component and SettingsView tests from REQ-027/028/029
2. **build** `npm run build`
   - Expected: clean build across main/preload/renderer

## Post-merge validation

- [ ] Action: launch the app, open Settings, click the "Next movie" binding and press Alt+N — Observable outcome: the binding chip shows the new combo, and pressing Alt+N in a movie detail view navigates to the next movie without restarting the app
- [ ] Action: quit and relaunch the app, reopen Settings — Observable outcome: the edited combo survived the restart (persisted to settings.json)
- [ ] Action: click Reset to defaults — Observable outcome: bindings show Cmd/Ctrl+← and Cmd/Ctrl+→ again and work in the detail view

## Outputs

- Automated verification — `npx vitest run` passed 23 files / 119 tests.
- Automated verification — `npm run build` completed typecheck and main/preload/renderer bundle builds.

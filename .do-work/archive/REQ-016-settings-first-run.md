# REQ-016: Settings view & first-run experience

**UR:** UR-001
**Status:** done
**Created:** 2026-07-08
**Layer:** renderer
**Entry point:** `/settings` route (SettingsView); first-run guided empty state on launch with no key + no folders
**Terminal state:** User can add/remove library folders, save + validate the TMDB API key, and per-folder rescan with progress; a first-run user goes key → first folder → grid fills in
**Parent:**
**Closure proof:** commit:2f9f2a8 tests:passed
**Criteria approved:** agent-drafted
**Priority:** 1
**Size:** M
**Files:** src/renderer/src/views/SettingsView.vue, src/renderer/src/views/**tests**/SettingsView.test.ts
**Depends on:** REQ-013

## Task

Implement `SettingsView.vue` (replacing the Task 12 stub), styled per the `movie_world_settings` mockup (sectioned side-nav layout): a **Library** section (registered folders — add via native dialog, remove = forget only, per-folder Rescan with progress), a **Metadata** section (TMDB API key field with a validation check), and an **Appearance** section (poster-size, show-adult-ratings, and backdrop-blur controls bound to `usePreferencesStore`). Wire the first-run guided empty state (no key + no folders → enter key → add first folder → watch the grid fill). TDD the view.

## Context

From the plan (Task 14): SettingsView consumes `window.api.getSettings/setApiKey/addFolder/removeFolder/rescanFolder/onScanProgress` (REQ-011/012); test-ids `apikey-input`, `apikey-save`, `folder-add`, `folder-row` (per folder), `folder-remove`, `folder-rescan`. Removing a folder forgets it only (never deletes files). Rescan streams `scan:progress` via `onScanProgress`. Per ideate (Explorer): without a TMDB key, scanning still indexes but every card stays `pending` — so the first-run flow must make key entry unmissable, and the empty state should guide key → folder → results.

## Design reference

Match `docs/design/movie_world_settings/` (`code.html` + `screen.png`) and the Cinematic Minimalist tokens.

- **Layout:** left side-nav (`w-64`, `bg-surface-container-low`) listing the sections (Library, Metadata, Appearance) with active state `bg-secondary-container`; scrolling anchors highlight the active section. Main canvas has a `display-lg` "Settings" heading; each section is a `headline-md` `text-primary` heading over `.settings-card` (`#161617`, `rounded-xl`) rows.
- **Library section:** an "Add Folder" pill button (`bg-primary-container`), then one `folder-row` card per registered folder (folder icon + path, hover-revealed delete/remove), each with a per-folder Rescan control that shows streamed progress.
- **Metadata section:** the TMDB API-key field (`apikey-input` + `apikey-save`) with the validity result. (This replaces the mockup's decorative "Scraping" section — see omissions.)
- **Appearance section** (bound to `usePreferencesStore`, REQ-013): a **Poster Size** range control (small ↔ large) → `posterSize`; a **Show adult ratings (R18+)** toggle → `showAdultRatings`; an **Enable backdrop blur** toggle → `backdropBlur`. Use the mockup's custom toggle/slider styling.
- **Decorative / out-of-scope mockup elements (omit):** the **Scraping** section's "Metadata Provider" and "Preferred Language" selects (TMDB-only, single language for v1); "Automatically download posters" (posters always fetch on match); the **"Scan library on startup"** toggle (scan-on-launch is always-on per the spec); the entire **About** section (version/storage/movie counts, Check-for-Updates, Documentation) and the side-nav user avatar / "Pro Plan" footer (no accounts, no auto-update in v1).

## Acceptance Criteria

- [ ] `SettingsView.vue` renders `apikey-input` + `apikey-save`; saving calls `window.api.setApiKey` and shows a validation result (valid/invalid key).
- [ ] `folder-add` calls `window.api.addFolder` (native dialog) and, on a non-null result, adds a `folder-row`; `folder-remove` calls `window.api.removeFolder` and removes that row (forget only — no file deletion).
- [ ] `folder-rescan` calls `window.api.rescanFolder(folder)` and displays progress driven by `onScanProgress`.
- [ ] The Appearance section renders three controls (test-ids `pref-poster-size`, `pref-adult-ratings`, `pref-backdrop-blur`) bound to `usePreferencesStore`; changing each updates the store (and thus `localStorage`) and is reflected live in the library grid / age-rating chips / glass effects.
- [ ] The view follows the mockup's sectioned side-nav layout (Library / Metadata / Appearance) in Cinematic Minimalist styling; the decorative Scraping-provider/language, Scan-on-startup, and About sections are omitted.
- [ ] First-run: with no API key and no folders, a guided empty state renders prompting the user to enter a key and add a first folder (so a new user is led to a filled grid).
- [ ] The SettingsView test passes under `npx vitest run` (stubbing `window.api`), asserting the test-ids and that add/remove/save/rescan invoke the right `window.api` methods and the Appearance controls write to the preferences store.

## Verification Steps

1. **test** `npx vitest run src/renderer/src/views/__tests__/SettingsView.test.ts` — Expected: renders `apikey-input`/`apikey-save`/`folder-add`/`folder-row`/`folder-remove`/`folder-rescan` and the Appearance `pref-poster-size`/`pref-adult-ratings`/`pref-backdrop-blur` controls; save/add/remove/rescan invoke the corresponding `window.api` methods; Appearance controls write to `usePreferencesStore`; first-run empty state renders when settings are empty.
2. **build** `npx tsc --noEmit` — Expected: exit 0.
3. **test** `npx eslint . --max-warnings 0` — Expected: exit 0.
4. **build** `npm run build` — Expected: renderer builds; no errors.

## Post-merge validation

- [ ] Fresh launch (no key, no folders) via `npm run dev` — Observable outcome: guided empty state appears; entering a valid TMDB key then adding a folder starts a scan and the grid fills with poster cards.
- [ ] Enter an invalid TMDB key and save — Observable outcome: the validation check reports the key as invalid.
- [ ] Change each Appearance control — Observable outcome: poster size changes the grid density, toggling adult ratings shows/hides R18+ chips, toggling backdrop blur enables/disables the glass effects; all three persist across an app restart.

## Integration

**Reachability:** `SettingsView` is the `/settings` route (REQ-014 router); reachable from app navigation. The first-run empty state is shown by the App shell / LibraryView when settings are empty.

**Data dependencies:** Reads/writes settings (folders + API key) via `window.api.getSettings/setApiKey/addFolder/removeFolder` (REQ-012 → REQ-003). Rescan progress arrives via `onScanProgress` (`ScanProgress`, REQ-002). Appearance controls read/write `usePreferencesStore` (REQ-013), which persists to `localStorage` only — **not** the main-process settings JSON.

**Service dependencies:** `window.api` (REQ-012), `useLibraryStore` for reflecting scan results + `usePreferencesStore` for Appearance (REQ-013), Cinematic Minimalist tokens (REQ-001), native folder dialog + rescan in main (REQ-011).

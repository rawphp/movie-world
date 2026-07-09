# REQ-025: Detail-view keyboard prev/next navigation

**UR:** UR-006
**Status:** done
**Created:** 2026-07-09
**Layer:** renderer
**Entry point:**
**Terminal state:**
**Parent:** REQ-023
**Closure proof:** checkpoint_log:passed commit:71f209f
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** M
**Files:** src/renderer/src/views/MovieDetailView.vue, src/renderer/src/lib/movie-nav.ts, src/renderer/src/lib/**tests**/movie-nav.test.ts, src/renderer/src/views/**tests**/MovieDetailView.test.ts
**Depends on:** REQ-024, REQ-027

## Task

Wire keyboard prev/next navigation into `MovieDetailView.vue`:

1. Create `src/renderer/src/lib/movie-nav.ts` with a pure helper `adjacentMovieId(list: MovieRecord[], currentId: string, direction: 'prev' | 'next'): string | null` — finds the current id in the ordered list and returns the neighbour with wrap-around (first→last, last→first). Returns `null` for an empty list or a single-movie list where the neighbour would be the movie itself; if the current id is not in the list (movie dropped out of the active filter), fall back to the first (`next`) / last (`prev`) entry of the list.
2. In `MovieDetailView.vue`, register a `window` keydown listener on mount (removed on unmount) that:
   - loads the current keybindings via `window.api.getSettings()` on mount
   - ignores events when the Fix-match dialog is open (`fixing === true`) or when `event.target` is an `input`, `textarea`, `select` or contenteditable element
   - on a match of the prev/next combo (via `matchesCombo` from `src/shared/keybindings.ts`, `isMac` from `navigator.platform`), calls `event.preventDefault()` and `router.push({ name: 'movie', params: { id } })` with the id from `adjacentMovieId(store.list, currentId, direction)`
   - no-ops when `adjacentMovieId` returns `null`

The navigation list is `store.list` — the filtered + sorted getter — so navigation always follows the order the library grid displays.

## Context

Brief: keyboard combination in the detail view navigates to the previous/next movie. Clarifications: displayed-list order (filters + sort), wrap-around at edges. Ideate flagged: the view is reused across `/movie/:id` param changes (lazy-loaded component instance is reused — the existing `movie` computed at `src/renderer/src/views/MovieDetailView.vue:16` already reacts to `route.params.id`, so no remount handling is needed); shortcuts must not fire while typing or while FixMatchDialog is open; the current movie can be absent from the filtered list after a metadata update, so `adjacentMovieId` defines an explicit fallback.

## Acceptance Criteria

- [x] `adjacentMovieId` returns the next/previous id in list order, wraps at both edges, returns `null` for empty and single-item lists, and falls back to first/last when `currentId` is not in the list — all covered by unit tests
- [x] A `keydown` event on `window` matching the configured next combo causes `router.push` to the next movie id in `store.list` order (component test with mocked router)
- [x] A `keydown` matching a combo while the Fix-match dialog is open, or dispatched from an `input`/`textarea` target, causes no navigation
- [x] Non-matching keydowns (wrong key or wrong modifier set) cause no navigation and are not `preventDefault`ed
- [x] The keydown listener is removed on component unmount (no listener leak — assert via component test unmount + dispatch)
- [x] Bindings come from `window.api.getSettings().keybindings`, not hardcoded values (component test stubs getSettings with a custom combo and asserts it is honoured)

## Verification Steps

> Execute these after implementation to confirm the feature actually works at runtime. Each must pass before committing.

1. **test** `npx vitest run src/renderer/src/lib/__tests__/movie-nav.test.ts`
   - Expected: adjacency/wrap/fallback unit tests pass
2. **test** `npx vitest run src/renderer/src/views/__tests__/MovieDetailView.test.ts`
   - Expected: keydown → router.push component tests pass, including suppression cases (handoff: keydown event → router navigation)
3. **test** `npx vitest run`
   - Expected: full suite green
4. **build** `npm run build`
   - Expected: clean build, no type errors

## Integration

**Reachability:** Runs inside the existing detail route `/movie/:id` registered at `src/renderer/src/router.ts:8`; the listener is mounted from `src/renderer/src/views/MovieDetailView.vue`.

**Data dependencies:** Reads the ordered movie list from the `list` getter of the library store (`src/renderer/src/stores/library.ts:21`), the current id from `route.params.id` (`src/renderer/src/views/MovieDetailView.vue:16`), and keybindings from `window.api.getSettings()` (`src/preload/index.d.ts:7`).

**Service dependencies:** Uses `matchesCombo` from `src/shared/keybindings.ts` (REQ-024), vue-router's `router.push` (already imported in the view at line 3), and the existing `fixing` ref (`src/renderer/src/views/MovieDetailView.vue:14`) to suppress shortcuts while the dialog is open.

## Outputs

- src/renderer/src/lib/movie-nav.ts — Added pure adjacentMovieId helper for previous/next list navigation with wrap and fallback behavior.
- src/renderer/src/lib/**tests**/movie-nav.test.ts — Added focused unit coverage for adjacentMovieId edge cases.
- src/renderer/src/views/MovieDetailView.vue — Wired settings-backed keydown navigation, suppression for dialogs/editable targets, unmount cleanup, and guarded async listener registration after unmount.
- src/renderer/src/views/**tests**/MovieDetailView.test.ts — Added component coverage for navigation, suppression, listener cleanup, custom settings keybindings, and async unmount race regression.

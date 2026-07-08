# REQ-013: Renderer filtering library & Pinia store

**UR:** UR-001
**Status:** done
**Created:** 2026-07-08
**Layer:** renderer
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** commit:ecab766 tests:passed
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** M
**Files:** src/renderer/src/lib/filtering.ts, src/renderer/src/stores/library.ts, src/renderer/src/stores/preferences.ts, src/renderer/src/lib/__tests__/filtering.test.ts, src/renderer/src/stores/__tests__/library.test.ts, src/renderer/src/stores/__tests__/preferences.test.ts
**Depends on:** REQ-012

## Task

Implement the pure filtering/sorting library (`src/renderer/src/lib/filtering.ts`), the Pinia `library` store (`src/renderer/src/stores/library.ts`), and the Pinia `preferences` store (`src/renderer/src/stores/preferences.ts`) that backs the design's Appearance controls. Filtering: `LibraryFilters`, `SortKey`, `EMPTY_FILTERS`, `filterMovies`, `sortMovies`. Library store: state (movies map, filters, sort, loaded), getters (`list`, `allGenres`, `allActors`, `allYears`, `allCertifications`, `pendingCount`), actions (`load`, `applyUpdate`, `setFilter`, `resetFilters`, `setSort`). Preferences store: `posterSize`, `showAdultRatings`, `backdropBlur`, persisted to `localStorage`. TDD all three.

## Context

From the plan (Task 11): filters are text search, genre, year, AU certification, min ★ rating (0–10 TMDB scale), actor, and watched/`unwatched`/`all`; sort by title/year/rating/lastWatched — all in-memory and combinable. `load()` calls `window.api.loadLibrary` and subscribes to `onMovieUpdated` exactly once; `applyUpdate(m)` merges a live update into the movies map. Per ideate (Connector): live updates arrive via the single `movie:updated` channel (REQ-011/012); the store is the renderer-side sink for the manager's `commit` stream.

**Preferences store (design's Appearance section — `docs/design/movie_world_settings/`):** these are pure renderer-side UI preferences, so they live in a Pinia `preferences` store persisted to `localStorage` — **no** change to the main-process `Settings` model (REQ-002/003) or IPC (REQ-011/012). State: `posterSize: 'small' | 'medium' | 'large'` (controls the LibraryView grid density / card scale — the mockup's poster-size slider), `showAdultRatings: boolean` (when `false`, R18+/adult age-rating badges are hidden on cards and detail), `backdropBlur: boolean` (when `false`, glassmorphic `backdrop-filter` blur effects are disabled app-wide — top bar, filter bar, FixMatchDialog — falling back to solid surfaces, per the mockup's "Enable backdrop blur … (Requires GPU)" toggle). Sensible defaults: `medium`, `false`, `true`. The store hydrates from `localStorage` on init and writes back on change. Consumed by MovieCard/LibraryView (REQ-014) and written by SettingsView (REQ-016).

## Acceptance Criteria

- [ ] `filterMovies(movies, f)` applies search, genre, year, AU certification, min-rating, actor, and watched-state filters, combinable (multiple active filters AND together); `EMPTY_FILTERS` matches everything.
- [ ] `sortMovies(movies, key)` orders by each `SortKey` (`title`, `year`, `rating`, `lastWatched`) deterministically.
- [ ] The store `load()` action calls `window.api.loadLibrary`, populates the movies map, sets `loaded: true`, and subscribes to `onMovieUpdated` exactly once (a second `load()` does not double-subscribe).
- [ ] `applyUpdate(m)` inserts/replaces movie `m` in the map so the `list` getter reflects it.
- [ ] Getters `allGenres`, `allActors`, `allYears`, `allCertifications` return de-duplicated sorted option lists derived from the movies; `pendingCount` counts `pending` movies; `list` returns filtered+sorted movies.
- [ ] `setFilter(patch)`, `resetFilters()`, `setSort(key)` update state and are reflected by `list`.
- [ ] `usePreferencesStore` exposes `posterSize` (`'small' | 'medium' | 'large'`), `showAdultRatings` (boolean), and `backdropBlur` (boolean) with defaults `medium`/`false`/`true`; it hydrates from `localStorage` on init and persists each change back to `localStorage`.
- [ ] Filtering, library-store, and preferences-store tests pass under `npx vitest run` (store tests stub `window.api`; preferences test stubs `localStorage`).

## Verification Steps

1. **test** `npx vitest run src/renderer/src/lib/__tests__/filtering.test.ts src/renderer/src/stores/__tests__/library.test.ts src/renderer/src/stores/__tests__/preferences.test.ts` — Expected: all pass, including combined filters, each sort key, single-subscription on repeat `load()`, getter derivations, and preferences hydrate/persist round-trip.
2. **build** `npx tsc --noEmit` — Expected: exit 0.
3. **test** `npx eslint . --max-warnings 0` — Expected: exit 0.

## Integration

**Reachability:** The `useLibraryStore` store is consumed by `FilterBar.vue`, `LibraryView.vue` (REQ-014), `MovieDetailView.vue` (REQ-015), and `SettingsView.vue` (REQ-016). `filterMovies`/`sortMovies` back the store's `list` getter. `usePreferencesStore` is written by `SettingsView.vue`'s Appearance section (REQ-016) and read by `MovieCard.vue`/`LibraryView.vue` (REQ-014, poster size + adult-rating gating) and the app shell / FixMatchDialog (backdrop-blur gating).

**Data dependencies:** Reads the full library via `window.api.loadLibrary` and live updates via `window.api.onMovieUpdated` (REQ-012). Holds the renderer-side `Record<id, MovieRecord>` mirror of the main process model. `usePreferencesStore` persists to `localStorage` only (no IPC / main-process settings).

**Service dependencies:** Pinia (installed REQ-001), `window.api` (REQ-012), `MovieRecord` type (`@shared/types`, REQ-002).

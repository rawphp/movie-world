# Context Pack - movie-world

Generated: 2026-07-10
Scope: UR-008 Google Drive/offline metadata and artwork cache

## Architecture

movie-world is an Electron desktop app built with electron-vite, Vue, Pinia,
TypeScript, and Vitest. The app has three process boundaries:

- Main process (`src/main/`) owns filesystem access, settings, library scanning,
  TMDB fetches, local artwork serving over `mw-art:`, IPC, and window lifecycle.
- Preload (`src/preload/`) exposes the typed `window.api` bridge.
- Renderer (`src/renderer/src/`) owns Vue routes, components, Pinia state,
  filtering, and user-visible library/detail/settings surfaces.

The UR-008 problem is that `.nfo`, poster, and fanart sidecars live beside movie
files in a Google Drive-backed folder. Synchronous reads or startup scans against
evicted Drive files can block the main process and freeze first paint. The target
design is cached-first local app data plus background reconciliation.

## Directory Roles

- `src/shared/` - cross-process domain types.
- `src/main/library/` - discovery, NFO parsing, scanner ingestion, manager state,
  and focused tests.
- `src/main/tmdb/` - fetch queue, TMDB client/matcher, image downloads.
- `src/main/art-protocol.ts` - `mw-art:` decoding, local image reads, CSP, and
  YouTube header helpers.
- `src/main/ipc.ts` - main-process IPC registration for settings, library,
  movie actions, TMDB search, and file reveal.
- `src/preload/` - renderer-visible API bridge and typings.
- `src/renderer/src/stores/` - Pinia library state.
- `src/renderer/src/views/` - Library, detail, settings, and view tests.
- `src/**/__tests__/` - Vitest tests colocated by process/layer.

## Key Main Files

- `src/shared/types.ts` defines `MovieRecord`, `Settings`, `ScanProgress`, and
  playback/match types shared across process boundaries. Add cache/status fields
  here when they cross main/preload/renderer.
- `src/main/library/manager.ts` owns `loadLibrary()`, `rescanFolder()`, in-memory
  movie state, scan progress emission, fetch queue creation, and movie updates.
  Current `loadLibrary()` scans every registered folder before returning.
- `src/main/library/scanner.ts` discovers video files and builds `MovieRecord`
  objects. It currently stats the video file, reads sidecar NFO, and sets poster
  and fanart only when source sidecar files exist.
- `src/main/library/nfo.ts` owns sidecar path conventions, NFO XML parsing and
  writing. `readSidecarNfo()` currently uses synchronous `existsSync/readFileSync`
  against the movie-folder `.nfo`.
- `src/main/art-protocol.ts` serves `mw-art:` URLs by synchronously reading the
  decoded absolute path and returning a `Response`; missing paths return 404.
- `src/main/ipc.ts` wires the manager to `library:load`, `library:rescan`,
  `movie:*`, and event emission.

## Key Renderer And Bridge Files

- `src/preload/index.ts` exposes `window.api` methods and event subscriptions.
- `src/preload/index.d.ts` is the TypeScript contract consumed by renderer code.
- `src/renderer/src/stores/library.ts` loads movies, subscribes to updates, and
  derives filters/facets. It currently tracks only `loaded` and `subscribed`
  for load state.
- `src/renderer/src/views/LibraryView.vue` is the first-screen library grid and
  empty state. UR-008 status messaging belongs here if surfaced to the user.
- `src/renderer/src/views/SettingsView.vue` already renders scan progress from
  `scan:progress`; preserve this path while extending status.
- `src/renderer/src/lib/art.ts` maps local poster/fanart filesystem paths to
  `mw-art:` URLs; prefer cached artwork paths before rendering.

## Existing Behavior To Preserve

- Movie folders remain the portable source of truth when available; local cache
  is a startup/display acceleration layer, not a paid/cloud service.
- Existing sidecar `.nfo`, poster, and fanart support must keep working.
- Existing `movie:updated` and `scan:progress` events should continue to drive
  renderer updates.
- Manual rescan is explicit and may mark vanished files missing; cached-first
  initial load should not erase useful records just because Drive is offline.
- `mw-art:` URL encoding and renderer CSP compatibility must remain intact.
- Missing/unavailable artwork should resolve fast to the existing fallback UI.

## UR-008 REQ Dependency Shape

- `REQ-031` creates an app-owned local library cache for `MovieRecord[]`.
- `REQ-032` mirrors/reads metadata and artwork through app-owned cache paths.
- `REQ-033` makes startup cached-first and scans in the background.
- `REQ-034` makes artwork rendering prefer cache and fail fast when missing.
- `REQ-035` exposes cached/offline scan status through preload/store/view.

Dependencies enforce that `REQ-031` lands first, `REQ-032` second, `REQ-033`
third, then `REQ-034` and `REQ-035` can run once their parents are archived.

## Test And Command Conventions

- Full suite: `npx vitest run`
- Configured suite command: `npx vitest run`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Component tests requiring DOM use `// @vitest-environment jsdom`.
- Prefer focused tests listed in each REQ before broad suite runs.

## Useful Focused Tests

- Cache: `src/main/library/__tests__/cache.test.ts`
- NFO/scanner: `src/main/library/__tests__/nfo.test.ts`,
  `src/main/library/__tests__/scanner.test.ts`
- Manager: `src/main/library/__tests__/manager.test.ts`
- Artwork protocol: `src/main/__tests__/art-protocol.test.ts`
- Renderer art/detail/card: `src/renderer/src/components/__tests__/MovieCard.test.ts`,
  `src/renderer/src/views/__tests__/MovieDetailView.test.ts`
- Library store/status: `src/renderer/src/stores/__tests__/library.test.ts`,
  `src/renderer/src/views/__tests__/LibraryView.test.ts`,
  `src/renderer/src/views/__tests__/SettingsView.test.ts`
- Preload bridge: `src/preload/__tests__/index.test.ts`

## Implementation Notes For Workers

- Keep cache paths under Electron app-owned data/cache storage, not inside any
  registered movie folder. Tests can inject temp dirs or helper path factories.
- Avoid making startup depend on synchronous reads from Google Drive-backed
  sidecar paths. If source files are missing/unavailable, return cached records
  or fast fallbacks.
- When adding shared status types, update main payloads, preload typing, store
  state, and renderer tests together.
- Preserve existing typed IPC contracts; extend payloads conservatively.
- Do not add paid services or external dependencies for this fix.

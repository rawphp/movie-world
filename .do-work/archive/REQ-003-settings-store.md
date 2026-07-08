# REQ-003: JSON settings store

**UR:** UR-001
**Status:** done
**Created:** 2026-07-08
**Layer:** main
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** commit:686113d tests:passed
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** S
**Files:** src/main/settings.ts, src/main/__tests__/settings.test.ts
**Depends on:** REQ-002

## Task

Implement `createSettingsStore(filePath)` in `src/main/settings.ts` — a factory exposing `read(): Settings`, `setApiKey(key): Settings`, `addFolder(path): Settings` (dedup), and `removeFolder(path): Settings`, persisting to a JSON file in the app-data dir. Follow TDD: write the failing test first (`src/main/__tests__/settings.test.ts`), then implement.

## Context

From the plan (Task 2, Steps 2–5): the settings file holds only registered folder paths and the TMDB API key. Defaults when the file is absent are `{ folders: [], tmdbApiKey: null }`. `addFolder` dedups via a Set; `removeFolder` filters. Values persist across store instances (each write reads-modifies-writes the JSON, `mkdir -p` on the parent dir). The plan gives the exact test (defaults when no file; persistence + dedup across instances) and implementation.

## Acceptance Criteria

- [ ] `createSettingsStore(file).read()` returns `{ folders: [], tmdbApiKey: null }` when the file does not exist.
- [ ] `setApiKey('k123')` then a fresh store instance reading the same file returns `tmdbApiKey: 'k123'`.
- [ ] `addFolder('/Movies')` called twice results in a single `/Movies` entry (deduped).
- [ ] `removeFolder('/More')` removes that entry; the remaining folders persist across a new store instance.
- [ ] The settings test (`src/main/__tests__/settings.test.ts`) passes (2 tests) under `npx vitest run`.

## Verification Steps

1. **test** `npx vitest run src/main/__tests__/settings.test.ts` — Expected: 2 tests pass (defaults + persistence/dedup across instances).
2. **build** `npx tsc --noEmit` — Expected: exit 0.
3. **test** `npx eslint . --max-warnings 0` — Expected: exit 0.

## Integration

**Reachability:** Instantiated once in the main process wiring (`src/main/index.ts`, REQ-011) with the app-data settings path, and passed into the library manager (REQ-010) and IPC handlers (REQ-011) which expose `getSettings`/`setApiKey`/`addFolder`/`removeFolder` to the renderer via `window.api` (REQ-012).

**Data dependencies:** Reads/writes a single JSON file (folders list + `tmdbApiKey`) in the Electron app-data directory. Consumes the `Settings` type from `@shared/types` (REQ-002).

**Service dependencies:** Node `fs` (`existsSync`, `readFileSync`, `writeFileSync`, `mkdirSync`) and `path`. No Electron API dependency in the factory itself (path is injected), keeping it unit-testable.

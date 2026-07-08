# REQ-002: Shared domain types

**UR:** UR-001
**Status:** backlog
**Created:** 2026-07-08
**Layer:** shared
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 3
**Size:** S
**Files:** src/shared/types.ts
**Depends on:** REQ-001

## Task

Write `src/shared/types.ts` as the single source of truth for the cross-process domain model: `MatchStatus`, `CastMember`, `ParsedFilename`, `MovieRecord`, `Settings`, and `ScanProgress`. Every later REQ in main, preload, and renderer imports these types — the signatures must match the plan exactly.

## Context

From the plan (Task 2, Step 1), the exact type definitions are specified, including `MovieRecord` with `id` (sha1 of filePath), `filePath`, `fileSize`, `folderPath`, parsed vs. resolved title/year, `matchStatus`, TMDB fields (`tmdbId`, `title`, `originalTitle`, `overview`, `runtime`, `voteAverage`, `genres`, `cast: CastMember[]`, `certifications: Record<string,string>`, `certificationAu`, `trailerYoutubeKey`), watch state (`playCount`, `lastPlayedAt`), and status flags (`fileMissing`, `sidecarWriteFailed`, `fetchFailed`), plus on-disk `posterPath`/`fanartPath`. `Settings = { folders: string[]; tmdbApiKey: string | null }`. `ScanProgress = { folder; discovered; ingested; done }`. Per ideate (Connector): this file is the real cross-process contract — it should land early and change rarely.

## Acceptance Criteria

- [ ] `src/shared/types.ts` exports `MatchStatus` as the union `'pending' | 'matched' | 'unmatched'`.
- [ ] It exports `CastMember { name: string; order: number }` and `ParsedFilename { title: string; year: number | null }`.
- [ ] It exports `MovieRecord` with every field listed in the plan (id, filePath, fileSize, folderPath, parsedTitle, parsedYear, matchStatus, tmdbId, title, originalTitle, year, overview, runtime, voteAverage, genres, cast, certifications, certificationAu, trailerYoutubeKey, playCount, lastPlayedAt, fileMissing, sidecarWriteFailed, fetchFailed, posterPath, fanartPath) with the specified nullability.
- [ ] It exports `Settings` and `ScanProgress` matching the plan.
- [ ] `npx tsc --noEmit` passes with the new file present.

## Verification Steps

1. **build** `npx tsc --noEmit` — Expected: exit 0; the types file compiles with no errors.
2. **test** `npx eslint src/shared/types.ts --max-warnings 0` — Expected: exit 0.
3. **runtime** `node -e "require('esbuild') || 0"` is not required; instead confirm importability by adding no code — rely on step 1. Expected: n/a (types-only module has no runtime surface).

## Integration

**Reachability:** Imported via the `@shared` alias (configured in REQ-001's `vitest.config.ts` / `electron.vite.config.ts`) by every module in `src/main/*`, `src/preload/*`, and `src/renderer/*`. No user-facing surface of its own.

**Data dependencies:** Defines the in-memory `MovieRecord` shape that mirrors the on-disk NFO fields (REQ-005) and the `Settings` shape persisted by the settings store (REQ-003).

**Service dependencies:** None — pure TypeScript type declarations, no runtime imports.

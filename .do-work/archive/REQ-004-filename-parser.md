# REQ-004: Filename parser

**UR:** UR-001
**Status:** done
**Created:** 2026-07-08
**Layer:** main
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** commit:cad5ce6 tests:passed
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** S
**Files:** src/main/library/filename-parser.ts, src/main/library/__tests__/filename-parser.test.ts
**Depends on:** REQ-002

## Task

Implement `parseFilename(basename: string): ParsedFilename` in `src/main/library/filename-parser.ts` — extract a clean title and optional year from a movie filename, stripping release tags. Add a folder-name fallback: when the filename yields no usable title/year, the caller can parse the parent folder name instead. Follow TDD with a table-driven test covering dotted names, year-less files, and release-tag-laden names.

## Context

From the plan (Task 3): parser strips release tags (`1080p`, `BluRay`, `x264`, etc.), converts dots/underscores to spaces, and extracts a 4-digit year in range. Match confidence downstream (REQ-006) uses normalized-title equality AND year within ±1, with the year check skipped when no year is present. Per UR-001 clarification: **when the filename alone is unhelpful (e.g. `movie.mkv`), fall back to the containing folder name** (e.g. `The Matrix (1999)/`). Per ideate (Explorer): the parser is the single biggest determinant of match rate, so cover the messy cases in the test table.

## Acceptance Criteria

- [ ] `parseFilename('The.Matrix.1999.1080p.BluRay.x264.mkv')` returns `{ title: 'The Matrix', year: 1999 }` (dots→spaces, release tags stripped).
- [ ] `parseFilename('Amelie.mkv')` (no year) returns `{ title: 'Amelie', year: null }`.
- [ ] `parseFilename('The Matrix (1999).mkv')` returns `{ title: 'The Matrix', year: 1999 }`.
- [ ] A 4-digit sequence outside a plausible film-year range (e.g. a resolution like `2160`) is not treated as the year.
- [ ] Folder-name fallback: given an unhelpful filename such as `movie.mkv`, parsing the parent folder name `The Matrix (1999)` yields `{ title: 'The Matrix', year: 1999 }` (documented and covered by a test case, so the scanner in REQ-007 can apply it).
- [ ] The table-driven test (`src/main/library/__tests__/filename-parser.test.ts`) passes under `npx vitest run`.

## Verification Steps

1. **test** `npx vitest run src/main/library/__tests__/filename-parser.test.ts` — Expected: all table rows pass, including dotted names, year-less files, resolution-not-year, and the folder-name fallback case.
2. **build** `npx tsc --noEmit` — Expected: exit 0.
3. **test** `npx eslint . --max-warnings 0` — Expected: exit 0.

## Integration

**Reachability:** Called by the scanner (`src/main/library/scanner.ts`, REQ-007) during `ingestFile` when a video has no sidecar NFO, to produce a `pending` record's `parsedTitle`/`parsedYear`.

**Data dependencies:** Consumes a filename string; produces `ParsedFilename` from `@shared/types` (REQ-002). No filesystem or network access.

**Service dependencies:** None — pure function, no external services.

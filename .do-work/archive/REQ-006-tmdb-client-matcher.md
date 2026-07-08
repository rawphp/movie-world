# REQ-006: TMDB client, matcher & details mapping

**UR:** UR-001
**Status:** done
**Created:** 2026-07-08
**Layer:** main
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:** commit:a483b6e tests:passed
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** M
**Files:** src/main/tmdb/client.ts, src/main/tmdb/matcher.ts, src/main/tmdb/**tests**/client.test.ts, src/main/tmdb/**tests**/matcher.test.ts
**Depends on:** REQ-002

## Task

Implement the TMDB v3 client (`src/main/tmdb/client.ts`) with an injectable `fetch`, and the matcher/details mapper (`src/main/tmdb/matcher.ts`). Client: `createTmdbClient(apiKey, fetchFn?)` with `searchMovies(query, year?)` and `getMovieDetails(id)` (using `append_to_response=credits,videos,release_dates`), plus `TmdbError` (has `status`), `TMDB_IMAGE_BASE`, and `imageUrl(path, size)`. Matcher: `pickConfidentMatch(parsed, results)` and `applyDetails(movie, details): MovieRecord`. TDD against mocked HTTP.

## Context

From the plan (Task 5): match confidence rule is normalized-title equality AND year within ±1 (year check skipped when the filename has no year). `applyDetails` returns a new record with `matchStatus: 'matched'` and all TMDB fields populated — including cast (top 5, billing order), genres, certifications for all countries, and the official YouTube trailer key (prefer official Trailer type from `videos`). Per UR-001 clarification: **`certificationAu` display falls back US → GB → first-available when TMDB has no AU release_dates entry**, but all countries are still stored in `certifications`. Per ideate (Connector): `applyDetails` is the single mapping used by both auto-match and fix-match, so it must be the only place TMDB details become a `MovieRecord`.

## Acceptance Criteria

- [ ] `searchMovies(query, year)` issues a TMDB `/search/movie` request carrying the api key and (when provided) the year; returns `TmdbSearchResult[]`.
- [ ] `getMovieDetails(id)` requests `/movie/{id}` with `append_to_response=credits,videos,release_dates`.
- [ ] A non-2xx TMDB response throws `TmdbError` with the HTTP `status` set (so the fetch queue can retry/surface).
- [ ] `pickConfidentMatch(parsed, results)` returns a result only when normalized titles are equal AND the year is within ±1; when `parsed.year` is null the year check is skipped; otherwise returns `null`.
- [ ] `applyDetails(movie, details)` returns a new record with `matchStatus: 'matched'`, top-5 cast in billing order, genres, `voteAverage`, runtime, overview, trailer YouTube key, `certifications` for all countries, and `certificationAu` resolved via the AU → US → GB → first-available fallback.
- [ ] `imageUrl(path, 'w500')` and `imageUrl(path, 'original')` build `https://image.tmdb.org/t/p/<size><path>`.
- [ ] Client and matcher tests pass under `npx vitest run` against a mocked `fetch`.

## Verification Steps

1. **test** `npx vitest run src/main/tmdb/__tests__/client.test.ts src/main/tmdb/__tests__/matcher.test.ts` — Expected: all pass, including the TmdbError-on-non-2xx case and the confidence/fallback logic.
2. **build** `npx tsc --noEmit` — Expected: exit 0.
3. **test** `npx eslint . --max-warnings 0` — Expected: exit 0.

## Integration

**Reachability:** `createTmdbClient` is instantiated by the library manager (REQ-010) from the stored API key; `searchMovies` is also reached from the renderer's fix-match dialog via `window.api.searchTmdb` (REQ-011/012). `pickConfidentMatch`/`applyDetails`/`imageUrl` are consumed by the fetch queue (REQ-008).

**Data dependencies:** Reads the TMDB API key from settings (REQ-003, via the manager). Produces/updates `MovieRecord` TMDB fields (`@shared/types`, REQ-002). No local persistence itself — the fetcher writes the NFO.

**Service dependencies:** TMDB v3 HTTP API. `fetch` is injectable so tests run against a mock; the manager supplies the real `fetch` in production.

# REQ-008: Fetch queue — concurrency, retries & sidecar writes

**UR:** UR-001
**Status:** backlog
**Created:** 2026-07-08
**Layer:** main
**Entry point:**
**Terminal state:**
**Parent:**
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** M
**Files:** src/main/tmdb/fetcher.ts, src/main/tmdb/__tests__/fetcher.test.ts
**Depends on:** REQ-005, REQ-006

## Task

Implement `src/main/tmdb/fetcher.ts`: `createFetchQueue(opts)` returning `{ enqueue(movie), idle() }` with concurrency (default 4) and retries (default 3, exponential backoff); `fetchAndApply(movie, client, downloadImage)` (single-movie pipeline reused by fix-match and retry); and `downloadImageToFile(url, dest, fetchFn?)`. On a confident match it writes the NFO and downloads poster/fanart, then emits the updated record via `onUpdate`. TDD with injectable client/downloadImage.

## Context

From the plan (Task 7): the queue processes `pending` movies at concurrency 4, calling `pickConfidentMatch` + `getMovieDetails` + `applyDetails` (REQ-006), then `writeSidecarNfo` + image downloads (REQ-005). No confident match → emit `unmatched`. Failures/rate limits retry with exponential backoff (3 attempts) then set `fetchFailed` for a manual Retry action. `fetchAndApply` is the single-movie pipeline also used by fix-match (REQ-010/013). Per ideate (Challenger): guard partial writes — if the NFO writes but an image download fails, the record must reflect that (e.g. keep `sidecarWriteFailed`/leave poster null) rather than claiming a complete match with a broken poster.

## Acceptance Criteria

- [ ] `createFetchQueue({ concurrency: 4, ... })` never runs more than 4 fetches at once (verifiable via an instrumented mock client counting concurrent in-flight calls).
- [ ] A confident match results in `writeSidecarNfo` being called and poster/fanart downloaded via the injected `downloadImage`, then `onUpdate` emits a `matched` record with on-disk `posterPath`/`fanartPath`.
- [ ] No confident match emits an `unmatched` record (no NFO write).
- [ ] A failing fetch retries up to 3 times with backoff, then emits a record with `fetchFailed: true` (no crash, queue continues with other movies).
- [ ] A NFO/image write failure leaves the record's poster path null and does not report a clean `matched`-with-poster (partial-write guard).
- [ ] `idle()` resolves only after all enqueued work (including retries) has settled.
- [ ] The fetcher test passes under `npx vitest run`.

## Verification Steps

1. **test** `npx vitest run src/main/tmdb/__tests__/fetcher.test.ts` — Expected: concurrency cap, matched/unmatched paths, retry-then-fetchFailed, partial-write guard, and `idle()` settling all pass with mocked client/downloadImage.
2. **build** `npx tsc --noEmit` — Expected: exit 0.
3. **test** `npx eslint . --max-warnings 0` — Expected: exit 0.

## Integration

**Reachability:** `createFetchQueue` is instantiated by the library manager (REQ-010); the manager enqueues `pending` movies during `loadLibrary`/`rescanFolder` and calls `fetchAndApply` for `fixMatch`/`retryFetch`. Emitted updates flow to the renderer through the manager's `commit`→`emit('movie:updated')` path (REQ-010/011).

**Data dependencies:** Writes NFO + poster/fanart sidecars (REQ-005); reads TMDB details (REQ-006). Operates on `MovieRecord`s (`@shared/types`, REQ-002).

**Service dependencies:** TMDB client (REQ-006), `writeSidecarNfo`/`sidecarPathsFor` (REQ-005), `imageUrl` (REQ-006), Node `fs`/`fetch` for image download.

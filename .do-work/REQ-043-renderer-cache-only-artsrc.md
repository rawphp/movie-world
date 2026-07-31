# REQ-043: Renderer Cache-Only artSrc

**UR:** UR-011
**Status:** backlog
**Created:** 2026-07-31
**Layer:** renderer
**Entry point:**
**Terminal state:**
**Parent:** REQ-041
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 3
**Size:** S
**Files:** src/renderer/src/lib/art.ts, src/renderer/src/components/MovieCard.vue, src/renderer/src/views/MovieDetailView.vue, src/renderer/src/components/__tests__/MovieCard.test.ts, src/renderer/src/views/__tests__/MovieDetailView.test.ts, src/renderer/src/lib/__tests__/art.test.ts
**Depends on:** REQ-042

## Task

Remove dual `artSrc(path, cachedPath)` Drive fallback. Renderer builds `mw-art` URLs only from app-owned cache display helpers (or null → empty string / placeholder). Update MovieCard and MovieDetailView call sites and tests.

## Context

Brief items 1 and 6: dual artSrc fallback must go. Clarification: ignore `posterPath`/`fanartPath` for paint. After protocol fail-fast, Drive URLs only produce 404s — stop requesting them.

## Acceptance Criteria

- [ ] `artSrc` (or successor) never encodes Drive/source `posterPath`/`fanartPath` when cache fields are null.
- [ ] MovieCard and MovieDetailView use shared display helpers / cache-only artSrc.
- [ ] Existing MovieCard/Detail tests updated: cache path → mw-art; Drive-only → empty/placeholder, not Drive mw-art URL.

## Verification Steps

1. **test** `npx vitest run src/renderer/src/lib/__tests__/art.test.ts src/renderer/src/components/__tests__/MovieCard.test.ts src/renderer/src/views/__tests__/MovieDetailView.test.ts`
   - Expected: pass; no Drive path appears in poster/fanart src when cache is null.
2. **build** `npm run typecheck`
   - Expected: clean.

## Integration

**Reachability:** Grid cards and detail hero (`MovieCard.vue`, `MovieDetailView.vue`) via `artSrc`.

**Data dependencies:** `MovieRecord` cache art fields from library store / IPC load result.

**Service dependencies:** Shared display helpers (REQ-042); main `mw-art` protocol for actual bytes.

## Assets

- (none)

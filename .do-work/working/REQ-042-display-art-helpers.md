# REQ-042: Display Art Helpers

<!-- claimed-start -->
**Claimed by:** Toms-MacBook-Pro.local.23552
**Claimed at:** 2026-07-31T03:43:48Z
**Heartbeat:** 2026-07-31T03:43:48Z
<!-- claimed-end -->

**UR:** UR-011
**Status:** in-progress
**Created:** 2026-07-31
**Layer:** shared
**Entry point:**
**Terminal state:**
**Parent:** REQ-041
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 3
**Size:** S
**Files:** src/shared/types.ts, src/shared/__tests__/display-art.test.ts
**Depends on:**

## Task

Encode the contract “display art is `cachedPosterPath` / `cachedFanartPath` only” in shared helpers (keep existing field names — do not rename). Export pure helpers that return the paint path or null, ignoring Drive `posterPath`/`fanartPath`.

## Context

Brief item 1 + clarification: keep names; change contract only. Shared helpers give main/renderer a single source of truth so dual-arg `artSrc` can collapse without scattering `cached ?? path` fallbacks.

## Acceptance Criteria

- [ ] Shared helper(s) return `cachedPosterPath` / `cachedFanartPath` (or null) and never select `posterPath` / `fanartPath` for display.
- [ ] Unit tests cover non-null cache, null cache with non-null Drive path (must return null), and both null.
- [ ] Field names remain `cachedPosterPath` / `cachedFanartPath` on `MovieRecord` (no rename).

## Verification Steps

1. **test** `npx vitest run src/shared/__tests__/display-art.test.ts`
   - Expected: all pass; Drive-only records yield null display paths.
2. **build** `npm run typecheck`
   - Expected: clean.

## Integration

**Reachability:** Called from renderer `artSrc` / MovieCard / MovieDetailView and optionally main when building paint-facing payloads (`src/renderer/src/lib/art.ts`, `src/shared/types.ts`).

**Data dependencies:** `MovieRecord.cachedPosterPath` / `cachedFanartPath` (`src/shared/types.ts`).

**Service dependencies:** None — pure functions.

## Assets

- (none)

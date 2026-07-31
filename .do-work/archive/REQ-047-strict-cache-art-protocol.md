# REQ-047: Strict Cache Art Protocol


**UR:** UR-011
**Status:** done
**Created:** 2026-07-31
**Layer:** main
**Entry point:**
**Terminal state:**
**Parent:** REQ-041
**Closure proof:** checkpoint_log:passed commit:8350f93
**Criteria approved:** agent-drafted
**Priority:** 2
**Size:** S
**Files:** src/main/art-protocol.ts, src/main/index.ts, src/main/__tests__/art-protocol.test.ts
**Depends on:** REQ-043

## Task

Make `userDataPath` required for `serveArtFile` (remove dual-mode optional). Always serve only under `{userData}/cache`. Stop full-buffer `Uint8Array.from(body)` copy — return body without duplicating bytes (type-safe BodyInit). Update all call sites and tests to pass userDataPath.

## Context

Brief items 3 and 7. Production `index.ts` already passes userDataPath; optional mode mainly exists for legacy tests. Dual-mode hides the invariant. Buffer copy is a first-paint perf regression.

## Acceptance Criteria

- [x] `serveArtFile` TypeScript API requires `userDataPath` (or options object where userDataPath is required).
- [x] Non-cache paths 404 without calling exists/read on those paths.
- [x] Successful cache serve does not allocate a full second copy of the image via `Uint8Array.from(entireBuffer)`.
- [x] All unit tests and production wiring pass required userDataPath.

## Verification Steps

1. **test** `npx vitest run src/main/__tests__/art-protocol.test.ts`
   - Expected: fail-fast + cache-serve tests pass; no dual-mode tests remaining that omit userDataPath.
2. **build** `npm run typecheck`
   - Expected: clean.

## Integration

**Reachability:** Electron `protocol.handle(MW_ART_SCHEME, ...)` in `src/main/index.ts`.

**Data dependencies:** Decoded absolute path under userData cache tree.

**Service dependencies:** `isAppOwnedCachePath`; Node fs exists/read.

## Assets

- (none)

## Outputs

- src/main/art-protocol.ts — Required userDataPath; cache-only; no copy
- src/main/index.ts — Protocol handler comment
- src/main/__tests__/art-protocol.test.ts — Tests

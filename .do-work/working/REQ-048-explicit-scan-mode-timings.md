# REQ-048: Explicit Scan Mode And Timings Gate

<!-- claimed-start -->
**Claimed by:** Toms-MacBook-Pro.local.23552
**Claimed at:** 2026-07-31T03:55:38Z
**Heartbeat:** 2026-07-31T03:55:38Z
<!-- claimed-end -->

**UR:** UR-011
**Status:** in-progress
**Created:** 2026-07-31
**Layer:** main
**Entry point:**
**Terminal state:**
**Parent:** REQ-041
**Closure proof:**
**Criteria approved:** agent-drafted
**Priority:** 1
**Size:** S
**Files:** src/main/library/manager.ts, src/main/library/scanner.ts, src/main/library/nfo.ts, src/main/startup-timings.ts, src/main/library/__tests__/manager.test.ts, src/main/library/__tests__/scanner.test.ts
**Depends on:** REQ-046

## Task

Replace `preferCache = !markMissing` with an explicit scan mode (`startup` | `rescan`) passed into scan/ingest/NFO. Gate or silence startup-timings production noise: no default `console.info` for stages ≥50ms unless `MW_STARTUP_TIMINGS=1`; remove or demote fossil `PRIMARY_FREEZE_ROOT_CAUSE` from product hot path (keep test-only if needed).

## Context

Brief item 6 + inferred clarification: startup = prefer cache, no mark missing; rescan = full source reconcile + mark missing. Boolean overload is a maintainability trap for backfill modes.

## Acceptance Criteria

- [ ] Manager uses explicit mode type/string for startup vs rescan; no `preferCache = !markMissing` assignment.
- [ ] Startup mode still does not mark missing; rescan still marks missing and reconciles source.
- [ ] Timing logs are off by default; enabled only when `MW_STARTUP_TIMINGS=1` (or equivalent documented env).
- [ ] Tests for startup vs rescan mode still pass; root-cause constant not required for product behavior tests.

## Verification Steps

1. **test** `npx vitest run src/main/library/__tests__/manager.test.ts src/main/library/__tests__/scanner.test.ts`
   - Expected: mode and nonblocking assertions pass.
2. **build** `npm run typecheck`
   - Expected: clean.

## Integration

**Reachability:** `loadLibrary` schedules startup mode scans; `rescanFolder` uses rescan mode (`src/main/library/manager.ts`).

**Data dependencies:** Movies map, folders from settings.

**Service dependencies:** `ingestFile` options, `readSidecarNfo` options, optional `onTiming` sink.

## Assets

- (none)

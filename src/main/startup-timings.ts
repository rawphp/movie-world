/**
 * Startup / artwork hot-path timings (REQ-037).
 *
 * Used to measure post-paint freeze stages against slow/cloud-only FS
 * (e.g. Google Drive) without inventing a second cache.
 */

export type StartupStage =
  | 'hydrateFromCache'
  | 'loadLibrary'
  | 'discoverVideoFiles'
  | 'ingestFile'
  | 'serveArtFile'

export interface StartupTimingEvent {
  stage: StartupStage
  durationMs: number
  /** Folder path, file path, or other stage-specific label. */
  detail?: string
}

export type TimingSink = (event: StartupTimingEvent) => void

/** (a) mw-art sync reads · (b) background scan FS · (c) both · (d) other */
export type FreezeRootCauseClass =
  | 'a_mw_art_sync_reads'
  | 'b_background_scan_fs'
  | 'c_both'
  | 'd_other'

/**
 * REQ-037 diagnosis constant — test-only fossil (REQ-048).
 * Not used on product hot paths; kept for art-protocol classification tests.
 */
export const PRIMARY_FREEZE_ROOT_CAUSE: FreezeRootCauseClass = 'a_mw_art_sync_reads'

export function createTimingBuffer(): {
  events: StartupTimingEvent[]
  sink: TimingSink
  clear: () => void
  durationsFor: (stage: StartupStage) => number[]
} {
  const events: StartupTimingEvent[] = []
  return {
    events,
    sink: (event) => {
      events.push(event)
    },
    clear: () => {
      events.length = 0
    },
    durationsFor: (stage) => events.filter((e) => e.stage === stage).map((e) => e.durationMs)
  }
}

export function emitTiming(
  sink: TimingSink | undefined,
  stage: StartupStage,
  durationMs: number,
  detail?: string
): void {
  const event: StartupTimingEvent = { stage, durationMs, detail }
  if (sink) sink(event)
  // Silent by default (REQ-048). Opt in with MW_STARTUP_TIMINGS=1 for diagnosis.
  if (process.env.MW_STARTUP_TIMINGS === '1') {
    console.info(`[startup-timing] ${stage} ${durationMs.toFixed(1)}ms${detail ? ` ${detail}` : ''}`)
  }
}

export function measureSync<T>(
  stage: StartupStage,
  fn: () => T,
  opts?: { sink?: TimingSink; detail?: string }
): T {
  const start = performance.now()
  try {
    return fn()
  } finally {
    emitTiming(opts?.sink, stage, performance.now() - start, opts?.detail)
  }
}

export async function measureAsync<T>(
  stage: StartupStage,
  fn: () => Promise<T>,
  opts?: { sink?: TimingSink; detail?: string }
): Promise<T> {
  const start = performance.now()
  try {
    return await fn()
  } finally {
    emitTiming(opts?.sink, stage, performance.now() - start, opts?.detail)
  }
}

/**
 * Classify freeze evidence from measured stages under a slow-FS simulation.
 * Prefer serveArtFile as primary when it alone accounts for the blocking wait
 * after loadLibrary has already returned.
 */
export function classifyStartupFreeze(evidence: {
  loadLibraryMs: number
  backgroundDiscoverMs: number
  serveArtFileMs: number
  /** True when loadLibrary awaited discover (should be false after REQ-033). */
  loadLibraryWaitedOnDiscover: boolean
  /** Threshold above which a stage is considered blocking (ms). */
  blockingMs?: number
}): FreezeRootCauseClass {
  const threshold = evidence.blockingMs ?? 100
  const artBlocks = evidence.serveArtFileMs >= threshold
  const scanBlocks =
    evidence.loadLibraryWaitedOnDiscover || evidence.backgroundDiscoverMs >= threshold

  if (artBlocks && scanBlocks && evidence.loadLibraryWaitedOnDiscover) return 'c_both'
  if (artBlocks) return 'a_mw_art_sync_reads'
  if (scanBlocks) return 'b_background_scan_fs'
  return 'd_other'
}

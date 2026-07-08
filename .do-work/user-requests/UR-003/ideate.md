# Ideate — UR-003

**Reviewed:** 2026-07-09

## Explorer — Assumptions & Perspectives

- The brief conflates two distinct failure modes. "Just a placeholder in the UI?" matches the `v-else` branch in `MovieDetailView.vue:170` ("No trailer found for this movie.") — which means `trailerYoutubeKey` is null (a data-pipeline problem in the main process). But "trailer not working" could equally mean the iframe renders and the video refuses to play (a renderer/embed/CSP problem). The fix lives in completely different layers depending on which it is, so diagnosis must come before any fix.
- Scope is undefined: is the placeholder shown for one movie or every movie? If every movie shows it, the TMDB fetch queue likely never populated trailers (e.g. no API key configured, fetch never ran); if only some, TMDB may genuinely have no trailer for those titles and the UI is behaving correctly.
- Environment is undefined: `buildCsp(isDev)` in `src/main/art-protocol.ts:70` produces different policies for dev vs packaged builds. The trailer could work in `npm run dev` and fail only in the packaged app — the brief doesn't say where it was observed.

## Challenger — Risks & Edge Cases

- YouTube embeds can load but refuse playback in Electron ("Video unavailable — watch on YouTube") because the renderer origin is `file://` in production, so no valid Referer/origin is sent and embed-restricted videos are blocked. If this is the failure, the fix is embed-URL strategy (e.g. `youtube-nocookie.com`, referrer policy), not CSP — triggered by the iframe at `MovieDetailView.vue:155`.
- `src/main/library/nfo.ts:102` only recovers a trailer key when the NFO `<trailer>` value starts with the Kodi `plugin://plugin.video.youtube/...` prefix. NFOs written by other tools (plain `https://youtube.com/watch?v=...` URLs) silently parse to null — a library imported from pre-existing NFOs would show the placeholder for every movie even though trailer data exists on disk.
- `src/main/library/scanner.ts:62` initialises `trailerYoutubeKey: null` at ingest; it stays null until the TMDB fetch succeeds. If fetch is failing or was never triggered for existing entries, the placeholder is the symptom of an upstream fetch bug, and fixing the UI would fix nothing.
- REQ-018 removed a conflicting meta CSP that blocked `mw-art:` posters — the same class of residual/duplicate CSP could still be blocking the `https://www.youtube.com` frame despite `frame-src` being present in `buildCsp`. A frame-level CSP violation is silent in the UI; only devtools console shows it.

## Connector — Links & Reuse

- REQ-018 (archived) is the direct sibling: same CSP surface, same "asset silently fails in renderer" shape, and its debugging pattern (inspect served CSP headers + devtools console) applies verbatim here — triggered by the CSP wiring at `src/main/index.ts:63-75`.
- Trailer selection logic already exists and is tested: `src/main/tmdb/matcher.ts:51-53` prefers official trailers and has coverage in `matcher.test.ts` / `fetcher.test.ts`. Any pipeline fix should extend those tests rather than add a parallel path.
- This is a bug brief with an unconfirmed root cause — capture should produce a diagnose-then-fix REQ (reproduction step first, fix scoped to the confirmed cause), not separate speculative fixes for every candidate cause.

## Summary

The single most important thing: determine which of the two failure modes is real — `trailerYoutubeKey` is null (data pipeline: TMDB fetch never ran/failed, or NFO parse dropped it) versus the iframe rendering but refusing playback (embed/CSP/file:// origin). The brief's wording points at the null-key placeholder branch, but this must be confirmed by reproduction before decomposing a fix. Capture should be a diagnosis-led bug-fix REQ, reusing REQ-018's CSP debugging pattern and the existing matcher/fetcher test suites.

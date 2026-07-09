# Ideate — UR-009

**Reviewed:** 2026-07-10

## Explorer — Assumptions & Perspectives

- **The new failure may be video-specific rather than app-wide.** If `0CYVGN98ZLA` has embedding disabled, been removed, or is region/account restricted, the detail page could show "This video is unavailable / Error code: 152 - 4" even though the app's generic embed plumbing is working; this is triggered by the brief naming one concrete YouTube watch URL rather than saying every trailer fails.
- **The acceptable fallback behavior is undefined.** If YouTube refuses inline embedding for a specific trailer, a good app may need to detect that case and offer a normal external YouTube link instead of leaving a dead iframe; this is triggered by the player already showing "Watch video on YouTube" in the screenshot/link.
- **The affected environment is not stated.** The existing code already injects YouTube `Referer`/`Origin` headers for the prior packaged `Error 153` issue, but `152 - 4` could reproduce in dev, packaged, or only after packaging/signing; this is triggered by the brief giving the player error but not the build mode.

## Challenger — Risks & Edge Cases

- **Changing headers again may chase the wrong cause.** If `152 - 4` comes from YouTube refusing this specific video key, broadening the existing `withYoutubeRefererHeaders` logic could regress TMDB/artwork/network behavior without fixing the unavailable trailer; this is triggered by `REQ-030` already implementing host-scoped referer/origin injection.
- **The app currently cannot distinguish "no trailer key" from "trailer key exists but embed cannot play."** The renderer only checks `movie.trailerYoutubeKey` before rendering the iframe, so an unembeddable video key can leave users stuck in YouTube's error frame; this is triggered by `MovieDetailView.vue` rendering a raw `https://www.youtube.com/embed/${key}` iframe with no fallback state.
- **An external fallback must not replace inline playback globally.** Prior UR-007 clarification required inline playback for valid trailers, so any fix that simply opens YouTube externally for all trailers would violate an existing standing decision; this is triggered by the current request being a specific unavailable-video error, not a request to remove embeds.

## Connector — Links & Reuse

- **Reuse the prior trailer-error boundary.** `src/main/art-protocol.ts` and `src/main/index.ts` already own YouTube CSP and referer/origin behavior from `REQ-030`; capture should first add regression coverage proving the existing header path still works before changing it.
- **The visible handling belongs in `MovieDetailView.vue` if the URL is genuinely unembeddable.** The detail page already owns the trailer iframe, empty state, and tests in `src/renderer/src/views/__tests__/MovieDetailView.test.ts`, so fallback UI for an embed-unavailable state should live there if diagnosis confirms video-specific refusal.
- **The trailer key source is probably out of scope unless multiple movies map to bad watch URLs.** `src/main/tmdb/matcher.ts` selects the official YouTube trailer key, and the brief's iframe reaches the exact video ID, so TMDB/NFO parsing should only be pulled in if diagnosis shows the app stored the wrong key.

## Summary

Treat this as a targeted trailer regression, not a rerun of the prior blank iframe or `153` work. The first task should diagnose whether `0CYVGN98ZLA` is unembeddable/video-specific versus an app-wide embed configuration failure; only then should implementation touch either the main-process YouTube request plumbing or the renderer fallback state.

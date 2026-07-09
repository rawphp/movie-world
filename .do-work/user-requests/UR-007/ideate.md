# Ideate — UR-007

**Reviewed:** 2026-07-09

## Explorer — Assumptions & Perspectives

- **The iframe is loading successfully — this is NOT a CSP or network failure.** YouTube's own branded error page ("Watch video on YouTube / Error 153 / Video player configuration error") is rendering inside the frame. That means the request reached YouTube and YouTube's player deliberately refused to initialise. CSP already permits `frame-src https://www.youtube.com` (`src/main/art-protocol.ts:80`), so the fix is not about *reaching* YouTube — it is about satisfying YouTube's embed-config validation. Any fix that only touches CSP or the iframe `src` URL will not move the needle.

- **Error 153 = the embed has no valid HTTP `Referer`/`Origin` YouTube will accept.** The renderer page origin is `file://…/index.html` when packaged (`src/main/index.ts:48-50`) and `http://localhost:PORT` in dev (`:46`). YouTube's embedded player rejects `file://` referers outright and increasingly rejects unregistered/localhost origins with 153. The brief calls it a "preview error"; the underlying mechanism is a referer/origin the player treats as an invalid configuration. Confirming this framing before capture is the highest-value assumption to lock down.

- **The fix almost certainly lives in the `main` layer, not `renderer`.** The reliable Electron remedy is to inject a valid `Referer` (and matching `Origin`) header — e.g. `https://www.youtube.com/` — onto outbound requests to YouTube embed hosts via `session.webRequest.onBeforeSendHeaders`, right alongside the existing `onHeadersReceived` CSP block (`src/main/index.ts:73-85`). This contradicts the surface reading of the brief ("movie detail pages" → renderer); the visible symptom is in the renderer but the correction is a network-session concern in main.

## Challenger — Risks & Edge Cases

- **Does it reproduce in dev, packaged, or both?** Dev serves `http://localhost` (a valid-ish http origin) while packaged serves `file://` (never valid). If 153 only appears when packaged, any fix verified only via `npm run dev` will look green while the real defect ships. The screenshot's chrome doesn't reveal which build it came from — capture must require verification in the mode(s) where the bug actually reproduces, and the header fix must cover *both* origins uniformly.

- **A blanket Referer/Origin injection is a security-relevant change and must be host-scoped.** Injecting `Referer: https://www.youtube.com` onto *every* outbound request would leak a spoofed referer to TMDB, artwork requests, and any future host. The interceptor must match only YouTube embed hosts (`www.youtube.com`, and likely `www.youtube-nocookie.com` / `*.googlevideo.com` that the player fetches), leaving `mw-art:` and TMDB requests untouched. Over-broad matching is the main regression risk.

- **This fix cannot be proven by a unit test alone — it needs a real launched app.** The failure is YouTube's server-side response to headers we can't mock meaningfully; a vitest test can assert "the interceptor sets Referer for youtube.com and not for tmdb", but "the trailer actually plays" is only observable by launching the app and watching the embed load. Expect a `## Post-merge validation` device/human check, not a purely automated closure.

- **153 is uniform across all trailers vs. per-video restrictions.** If a specific video owner disabled embedding, YouTube returns 101/150 ("Video unavailable"), not 153. The screenshot showing 153 signals an app-wide config problem affecting every trailer equally — good, because it means one fix covers all movies. But capture should sanity-check a second movie to confirm it's not coincidentally a per-video restriction masquerading as the same symptom.

## Connector — Links & Reuse

- **Reuse the exact site of the existing CSP/session wiring.** `src/main/index.ts:73-85` already registers a `session.defaultSession.webRequest.onHeadersReceived` handler and `art-protocol.ts` already owns the YouTube-host knowledge (`buildCsp`, `shouldApplyRendererCsp`). The header-injection fix belongs in the same neighbourhood and should share the host-matching logic rather than hard-coding `www.youtube.com` a third time.

- **`trailerYoutubeKey` sourcing is not implicated.** The key flows correctly from TMDB (`src/main/tmdb/matcher.ts:76`) through to the iframe `src` — the frame renders and reaches the right video, so matcher/NFO parsing is out of scope. Don't let capture pull that in.

- **Prior UR history is directly relevant.** UR-003 already dealt with the trailer feature and a dev-startup-hang dependency (`decisions.md`), and UR-005 reshaped this exact `MovieDetailView.vue` trailer section. The team has repeatedly opted `main`/`shared` layers out of scope for renderer-only work — but this fix *inverts* that pattern: it is a `main`-layer network fix for a renderer-visible symptom, so the usual "main out of scope" answer should NOT be the default here.

## Summary

The single most important thing to fix before decomposing: this is not a renderer/CSP bug — the iframe loads and YouTube itself rejects the embed with 153 because the app's `file://` / `localhost` origin carries no referer YouTube's player will accept. The fix is a host-scoped `Referer`/`Origin` header injection in the `main` process session (beside the existing CSP handler), and it must be host-scoped to avoid leaking a spoofed referer to TMDB/artwork. Because YouTube's response can't be meaningfully mocked, closure needs a real launched-app visual check in whichever build mode(s) actually reproduce 153 (confirm dev vs packaged).

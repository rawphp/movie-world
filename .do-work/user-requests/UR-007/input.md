---
ur: UR-007
received: 2026-07-09
status: intake
---

# UR-007: User Request

## Request

movie detail pages show preview error 'error 153'

(Screenshot attached: assets/error-153-screenshot.png — the "Leo (2023)" movie detail page. The Trailer section renders an embedded YouTube player showing:

> Watch video on YouTube
> Error 153
> Video player configuration error

The rest of the detail page — poster, synopsis, stars, rating, runtime, genres — renders correctly. Only the trailer embed fails.)

## Clarifications

**Q:** You said "fix the error 153" on the trailer. What's the acceptable end state — must the trailer play INLINE inside the app, or is an external-browser fallback acceptable?
**A:** Inline playback. The embedded YouTube player must actually load and play the trailer inside the detail page. The fix targets the referer/origin so YouTube's embed accepts the configuration; an "open in external browser" fallback is not the desired outcome.

**Q:** Where did you see Error 153 — in the dev app (npm run dev, http://localhost) or the packaged/built app (file://), or both?
**A:** Packaged/built app. The renderer origin is `file://`, so the fix must handle the `file://` origin and verification requires launching a packaged build and confirming the trailer plays in-app.

---
ur: UR-010
received: 2026-07-31
status: intake
---

# UR-010: User Request

## Request

When launching Movie World App, the screen freezes a lot of the times, which this should have been resolved and it seems like the issue came back, the original issue. You can check the git history for this or the workplace. The issue was that because the movie folder that we're using is in Google Drive and it's offline, it takes a long time to load all the assets. We should have fixed that but it still seems to get stuck on that. Investigate what is core would be a cause for the slow startup time where it freezes almost every time I think every time

## Clarifications

**Q:** Prior “should have been resolved” work — what was shipped?
**A:** UR-008 REQ-031–035: local library cache + cached-first loadLibrary + prefer cached artwork. loadLibrary still schedules background Drive scans after returning cache. Grid prefers cachedPosterPath only when that field is set on the record. *(inferred, confirmed)*

**Q:** You said to “investigate what is core would be a cause for the slow startup time.” What should this work deliver when done?
**A:** Diagnose then fix — find the real blocking stage, then implement a fix so launch no longer freezes on Drive.

**Q:** You said the screen freezes “almost every time” on launch. When do you first notice it?
**A:** After the grid appears (not before any library UI).

**Q:** After the grid appears and freezes, what do the movie cards look like?
**A:** Titles/text show; no posters (or at most 1 or 2). Screen frozen with loading indicator on the mouse.

**Q:** You said the movie folder is in Google Drive and “offline.” When the freeze happens, is Drive online?
**A:** Drive is online but files may be cloud-only (need download on access).

**Q:** You said “launching Movie World App.” Which build freezes this way?
**A:** Both packaged app and dev mode.

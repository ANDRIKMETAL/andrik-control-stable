ANDRIK SITE R1299 — YOUTUBE RADIO NEW LIVE 16:9
DATE: 2026-10-14
BASE: SITE-R1298-FACEBOOK-COMPACT-FULL.zip (full archive)

NEW OWNER RADIO LIVE:
https://www.youtube.com/live/QajCKMBDasA
YouTube videoId: QajCKMBDasA

CHANGES:
- Exact static fallback LIVE references replaced in home, radio control,
  dedicated YouTube control, /open-youtube.html and cache-reset utilities.
- Existing app opening (vnd.youtube:<videoId> Android + intent fallback) preserved.
  /open-youtube.html invalid empty app fallback repaired.
- Cloudflare worker: verifies current owner 16:9 LIVE ID against YouTube API
  before preferring it over cached old broadcast/discovery IDs.
- YouTube private control: prefers the newly created broadcast when selecting
  current stream while keeping the existing OAuth monitoring/health pipeline.
- Audience collector: samples/graph for TODAY filtered to the current video,
  so existing old-broadcast views are not mixed into the new radio's KPIs.
  Historical dates are preserved in D1; no database deletion or reset.
- PWA service-worker cache version advanced.

NOT CHANGED:
- VPS radio247/server.mjs, FFmpeg, RTMPS keys, music, clips, album rotation
- Original API environment bindings / tokens / D1 database / Facebook
- Existing client-side deep link to YouTube/ReVanced Android app

HOW TO DEPLOY:
1. Publish full ZIP through same static-site deployment procedure as R1298.
   DO NOT install this ZIP on Ubuntu radio service.
2. Visit https://andrikmetal.com/cache-reset.html
3. Close/reopen site Control PWA if installed.
4. Test https://andrikmetal.com/api/public/youtube-live-target?fresh=1
   Expected videoId=QajCKMBDasA, active=true while live; if no verified LIVE,
   API may report inactive (DO NOT fabricate counters).
5. Verify homepage 'Слушать радио' launches native YouTube app;
   verify /radio-youtube-admin.html and /radio-control-admin.html.
6. Allow up to a few minutes for D1 sampling (about 2min), YouTube API
   and caches to refresh. If current viewers or likes are withheld by YouTube,
   show — rather than guessing them.

ROLLBACK: republish SITE-R1298-FACEBOOK-COMPACT-FULL.zip.

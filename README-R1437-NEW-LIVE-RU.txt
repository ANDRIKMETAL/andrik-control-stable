ANDRIK SITE R1437 — NEW YOUTUBE LIVE + DAILY STATISTICS
NEW LIVE: https://www.youtube.com/live/lpc9HfVs0NY
BASE: SITE-R1431-NEW-YOUTUBE-LIVE-FULL.zip

- Static YouTube links updated on homepage, control, YouTube control and redirect.
- Worker active-live discovery prioritizes new ID but still checks YouTube API live state.
- 16 Oct daily graphs include both previous QajCKMBDasA and new lpc9HfVs0NY sessions.
- ViewCount increments are calculated per video ID, first sample per video is baseline.
- D1 database and historical data untouched. No invented views or likes.
- Android YouTube app deep linking preserved.
- PWA service worker cache versions updated.

DEPLOY: upload entire ZIP to Cloudflare Pages project hosting andrikmetal.com.
DO NOT INSTALL ON VPS. DO NOT RESTART RADIO.
After deploy: check /api/public/youtube-live-target?fresh=1 and refresh control PWA.
Note: the first new-stream API sample is baseline; daily totals grow with later samples.

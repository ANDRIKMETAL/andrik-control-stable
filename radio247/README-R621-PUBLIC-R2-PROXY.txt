ANDRIK RADIO R621 — PUBLIC READ-ONLY R2 PROXY

Problem fixed:
- music.andrikmetal.com returned HTTP 403 to AWS for the new master videos.

R621:
- exposes ONLY the three known radio master keys through /api/media/radio-visual-r621?slot=day|evening|night
- GET/HEAD are public read-only; no arbitrary R2 key can be requested
- PUT/upload remains protected by ADMIN_KEY
- AWS activation checks endpoint with HEAD, then caches full master locally via download=1
- 1080p25 / H.264 8 Mbps / AAC-LC 48 kHz stereo 192 kbps / PTS rebuild preserved

ANDRIK R966 — REMOVE TRACK FROM AIR
Base: R965 full preserved

New radio-control feature:
- Under NEW TRACK upload: "УБРАТЬ ИЗ ЭФИРА"
- Type a song title -> search R2 music library -> choose exact result -> remove from radio rotation
- MP3 remains in R2 and remains downloadable on Singles/Albums pages
- If currently playing, track finishes; it is removed from future queue/rotation
- Exclusion persists across radio restarts in /var/cache/andrik-radio-r622/radio-excluded-tracks-r966.json
- Re-uploading the same R2 key later automatically re-enables it in radio

Backend changes:
- Cloudflare radio remote command: track-remove
- R958 agent support for track-remove
- local radio endpoint: POST /control/track-remove?key=...&title=...
- future queue is cleaned surgically without restarting publisher

No changes to audio-sync scale, fullscreen logic, 24/7 single visual, clips/singles auto-publish, or game.

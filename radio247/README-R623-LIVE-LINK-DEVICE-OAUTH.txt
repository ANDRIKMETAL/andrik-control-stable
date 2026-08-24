R623 — EXACT RADIO LIVE LINK + AWS DEVICE OAUTH

SITE
- Radio button never intentionally opens an old/completed broadcast.
- /api/public/youtube-live-target resolves an actually LIVE video id.
- Low-quota uploads-playlist + videos.list probe, then eventType=live fallback.
- /radio-live server redirect is final resolver; if no verified LIVE exists it opens
  the channel Streams page, not /@andrikmetal/live.
- Android intent is package-neutral: official YouTube, ReVanced/RVX or another
  registered YouTube handler may open the exact watch video.

AWS / YOUTUBE
- youtube-device-console-r623.mjs uses Google's official device authorization flow.
- Requires a separate OAuth Client type: TVs and Limited Input devices.
- Scope: https://www.googleapis.com/auth/youtube (supports LiveBroadcasts writes).
- Tokens remain on AWS in /etc/andrik-youtube-device.json mode 0600.
- auto-safe can stop encoder briefly, enable Auto-start ON / Auto-stop OFF,
  restart the encoder, then start the broadcast if YouTube does not auto-transition.
- recover is the fast future recovery command.

R622 RADIO ENGINE
- Engine remains the proven R622 1080p25 / AAC 192k build.
- start-andrik-radio-r622.sh permanent local-variable bug is fixed in this package.

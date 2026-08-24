R620
====

1) STREAM VISUALS
- Day/evening/night 1080p originals are NOT stored in the site ZIP/repository anymore.
- R2 keys:
  radio/stream-day-master-r620.mp4      <- original 1000380218.mp4
  radio/stream-evening-master-r620.mp4  <- original 1000380224.mp4
  radio/stream-night-master-r620.mp4    <- original 1000380219.mp4
- Upload from: https://andrikmetal.com/radio-visuals-admin.html
- AWS downloads each master once to /var/cache/andrik-radio-r620 and loops the local copy.

2) VIDEO OUTPUT
- 1920x1080, 25 fps
- H.264 High, 8 Mbps CBR, keyframe 2 s
- QR + NOW + ticker rendered server-side

3) AUDIO
- local MP3 cache
- audio PTS regenerated for each track (asetpts=N/SR/TB)
- no async time-stretch resampler
- AAC-LC 48 kHz stereo 192 kbps

4) CURRENT LIVE BUTTON
- public button resolves the actually LIVE video id at click time.
- primary: OAuth read token; fallback: public YouTube Data API eventType=live.
- no completed/created video is accepted as the public target.

5) ALTERNATIVE YOUTUBE AUTH FOR AWS CONSOLE
- This is independent from the troublesome web OAuth flow.
- Create Google OAuth Client: TVs and Limited Input devices.
- Device flow requests the supported `https://www.googleapis.com/auth/youtube` scope (write/manage).
- On AWS after R620 pull:
  sudo bash /opt/andrik-radio/radio247/vm-lite/install-youtube-device-console-r620.sh
  sudo andrik-youtube auth
- Google shows a short device code. After approval, refresh token is stored only on AWS.
- Then:
  sudo andrik-youtube status
  sudo andrik-youtube autostart
  sudo andrik-youtube start
  sudo andrik-youtube recover

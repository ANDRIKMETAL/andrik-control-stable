# ANDRIK Metal Radio 24/7 — R620

Текущая схема:

- MP3: R2 → локальный кэш AWS → FFmpeg.
- Визуалы: оригинальные 1080p25 master-файлы в R2 → локальный постоянный AWS cache.
- В репозитории/ZIP сайта три radio-video больше не хранятся.
- YouTube output: 1920×1080, 25 fps, H.264 High, 5 Mbps CBR.
- Audio: AAC-LC 48 kHz stereo 192 kbps, regenerated audio PTS; async time-stretch отключён.
- QR, «СЕЙЧАС» и ticker накладываются на AWS.

## R2 visuals

- 08:00–16:59 — `https://music.andrikmetal.com/radio/stream-day-master-r620.mp4`
- 17:00–21:59 — `https://music.andrikmetal.com/radio/stream-evening-master-r620.mp4`
- 22:00–07:59 — `https://music.andrikmetal.com/radio/stream-night-master-r620.mp4`

Загрузка: `/radio-visuals-admin.html`

Соответствие исходников:
- day ← `1000380218.mp4`
- evening ← `1000380224.mp4`
- night ← `1000380219.mp4`

После загрузки R2 на AWS:

```bash
sudo bash /opt/andrik-radio/radio247/vm-lite/start-andrik-radio-r620.sh
```

Альтернативная YouTube авторизация из AWS-консоли:

```bash
sudo bash /opt/andrik-radio/radio247/vm-lite/install-youtube-device-console-r620.sh
sudo andrik-youtube auth
```

Нужен отдельный Google OAuth Client типа **TVs and Limited Input devices**.

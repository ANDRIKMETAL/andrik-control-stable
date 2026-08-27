# R665 — OVH native radio control

Control больше не вызывает старый AWS helper `/usr/local/sbin/andrik-youtube`. Новый OVH Agent R665 нативно управляет `andrik-radio.service`, а Cloudflare Worker переводит YouTube в LIVE/complete через OAuth.

Разовая установка агента на OVH после деплоя R665:

```bash
curl -fsSL https://andrikmetal.com/radio247/vm-lite/install-ovh-agent-r665.sh | sudo bash
```

# ANDRIK Metal Radio 24/7 — R620

Текущая схема:

- MP3: R2 → локальный кэш AWS → FFmpeg.
- Визуалы: оригинальные 1080p25 master-файлы в R2 → публичный read-only Worker proxy → локальный постоянный AWS cache.
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


## R621 public radio visual proxy
AWS no longer reads the private R2 custom domain directly. Only day/evening/night masters are exposed read-only through `/api/media/radio-visual-r621`; uploads stay ADMIN_KEY protected.


## R622 private master pull
AWS downloads the three daypart masters once through an ADMIN_KEY-protected endpoint, validates them, then restarts with persistent local copies.

## R702 — MP3 handoff final + permanent AUTO FIT

- Корень пропажи MP3 исправлен: FFmpeg cache-clean временно пишет в настоящий `.mp3` и использует явный `-f mp3` muxer.
- Следующий MP3 должен быть локально готов до старта клипа.
- Конец клипа контролируется по video-stream duration и реальному `frame=` progress, поэтому последний кадр не зависает из-за более длинной audio/container дорожки.
- Между локальными источниками master получает короткий silence bridge; RTMPS publisher не закрывается.
- После клипа сразу возвращается текущий DAY / EVENING / NIGHT visual, подпись переключается на следующий MP3 и запускается его звук.
- Постоянное правило видео: MP4 загружается как есть; весь исходный кадр автоматически FIT-вписывается в 1920×1080, crop/cover OFF, ручное растягивание не требуется.

После деплоя R702 на OVH выполнить один раз:

```bash
curl -fsSL https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main/radio247/vm-lite/install-r702-radio-handoff-final.sh | sudo env ANDRIK_SITE_BASE=https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main bash
```

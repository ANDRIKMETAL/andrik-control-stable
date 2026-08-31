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


## R703 — четыре визуальных периода

Стабильный R702 MP3/clip engine сохранён без изменений. Добавлен четвёртый master slot и точное расписание Europe/Bratislava:

- MORNING 06:00–12:00 — `radio/stream-morning-master-r703.mp4`
- DAY 12:00–18:00 — `radio/stream-day-master-r620.mp4`
- EVENING 18:00–24:00 — `radio/stream-evening-master-r620.mp4`
- NIGHT 00:00–06:00 — `radio/stream-night-master-r620.mp4`

MORNING можно назначить позже через `/radio-visuals-admin.html`. Пока его нет, утренний период безопасно использует DAY, поэтому текущий эфир не ломается.

После деплоя R703 на OVH выполнить один раз:

```bash
curl -fsSL https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main/radio247/vm-lite/install-r703-four-visual-cycles.sh | sudo env ANDRIK_SITE_BASE=https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main bash
```

## R710 — YouTube stability + safe R2 delete

R710 keeps the R709 visual library, R707 exact-title PCM handoff, R706 animated equalizer and R702 persistent publisher, but reduces ingest stalls:

- YouTube H.264 CBR: 4000 kbps at 1080p25.
- RTMPS recovery cushion: 3 seconds.
- MJPEG input queue: 64 frames instead of 2048.
- Local feeder: q=8 to reduce OVH CPU/pipe pressure.
- Safe DELETE controls for `radio/visual-library/*.mp4` and owner `radio/clips/*.mp4`.
- Active slot masters and built-in JOY OF BEING are protected.

After deploying R710, run once on OVH:

```bash
curl -fsSL https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main/radio247/vm-lite/install-r710-youtube-stability-r2-delete.sh | sudo env ANDRIK_SITE_BASE=https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main bash
```

## R794 — 2-vCPU CPU headroom + fade optimization

Normal MP3 live rendering is optimized without reducing the stream target:

- Output remains 1920×1080 / 25fps / H.264 6000k CBR.
- Permanent FIT+PAD / NO-CROP geometry is preserved.
- Live MP3 background scaling uses a CPU-light scaler; offline prepared clips still use Lanczos.
- The exact 0.65s darken → 0.05s black → 0.80s brighten transition is preserved at 25fps,
  but the old continuous 1920×1080 alpha-mask source/full-frame overlay is removed.
- QR / SUBSCRIBE / LIKE use live-only pre-scaled PNGs.
- R720 equalizer remains full 25fps and visually unchanged.
- Normal live x264 feeder is bounded to 2 threads for the 2-vCPU OVH server.

After deploying the R794 full ZIP:

```bash
curl -fsSL https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main/radio247/vm-lite/install-r794-cpu-headroom-fade-opt-r793-preserved.sh | sudo env ANDRIK_SITE_BASE=https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main bash
```


## R803 diagnostics
R803 updates only the OVH web/control diagnostic agent. It does not restart `andrik-radio.service`. The public sanitized diagnostic endpoint is `/api/public/radio-diagnostics-r803`; `/api/public/radio-diagnostics-r802` remains compatible.

## R803B diagnostics installer fix
Production OVH uses `andrik-radio-web-control.service` and `/usr/local/sbin/andrik-radio-web`. Use `vm-lite/install-r803b-diagnostics-web-control-no-radio-restart.sh`; it restarts only the web-control agent and proves the radio MainPID is unchanged.

## R803C — confirmed single-agent topology fix
R803C is based on the live VPS unit topology observed on 2026-08-31. The canonical control agent is `andrik-radio-web.service` (`/usr/local/sbin/andrik-radio-web daemon`); the historical `andrik-radio-web-agent.service` R650 daemon is a duplicate. R803C upgrades only the canonical agent to R803 diagnostics, stops/disables/Condition-blocks the R650 duplicate, and never restarts `andrik-radio.service`, FFmpeg or RTMPS.

### R803E Node 18 ESM wrapper fix
R803E keeps `/usr/local/sbin/andrik-radio-web` as a shell wrapper and executes the diagnostic agent from `/usr/local/lib/andrik-radio-web-agent-r803.mjs`. This avoids Node 18 treating an extensionless ES-module file as CommonJS. It changes only the web/control agent topology and never restarts `andrik-radio.service`.

## R821 — station no-drain make-before-break

R821 removes the legacy R804 station `sink-drain` / clean-stop wait that could create a local
video starvation window while RTMPS remained healthy. A bumper/special is now committed only
after its rawvideo **and** PCM audio are readable; the outgoing black MP3 visual stays LIVE until
that gate passes, then the raw-frame relay switches immediately without an H264/AU drain wait.
R820 master PTS lock, R819 fullscreen/no-crop and R814 MP3 fade timings are preserved.

After deploying R821, run once on OVH:

```bash
curl -fsSL https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main/radio247/vm-lite/install-r821-station-no-drain-make-before-break-r820-preserved.sh | sudo env ANDRIK_SITE_BASE=https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main bash
```

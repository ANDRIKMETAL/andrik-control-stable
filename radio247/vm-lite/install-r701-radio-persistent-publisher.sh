#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
QR="$BASE/assets/andrik-qr-r612.png"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-radio-r701.XXXXXX.mjs)"
BACKUP="$SERVER.bak-r701-$(date +%Y%m%d-%H%M%S)"
trap 'rm -f "$TMP"' EXIT

png_ok(){ [ -s "$1" ] && [ "$(od -An -tx1 -N8 "$1" 2>/dev/null | tr -d ' \n')" = "89504e470d0a1a0a" ]; }

[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
command -v node >/dev/null || { echo 'СТОП: node не найден'; exit 2; }
command -v ffmpeg >/dev/null || { echo 'СТОП: ffmpeg не найден'; exit 2; }
command -v ffprobe >/dev/null || { echo 'СТОП: ffprobe не найден'; exit 2; }
png_ok "$QR" || { echo 'СТОП: QR overlay повреждён — радио не трогаю.'; exit 2; }

# Проверяем, что ffmpeg этой VM понимает raw MJPEG input, который R701 использует
# только локально между feeder и постоянным YouTube publisher.
ffmpeg -hide_banner -h demuxer=mjpeg 2>/dev/null | grep -q framerate || { echo 'СТОП: ffmpeg без MJPEG framerate support.'; exit 2; }

echo '[1/5] Загружаю R701…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r701-$(date +%s)" -o "$TMP"
node --check "$TMP" >/dev/null

grep -q 'R701-R2-RADIO-CLIPS-PERSISTENT-PUBLISHER' "$TMP" || { echo 'СТОП: в источнике ещё не R701.'; exit 3; }
grep -q 'startNormalVisualProducerR701' "$TMP" || { echo 'СТОП: постоянный video feeder отсутствует.'; exit 3; }
grep -q 'ensureMasterForTrackR701' "$TMP" || { echo 'СТОП: persistent master guard отсутствует.'; exit 3; }
grep -q "'-f','mjpeg','-framerate',String(VIDEO_FPS),'-i','pipe:4'" "$TMP" || { echo 'СТОП: постоянный MJPEG video pipe отсутствует.'; exit 3; }
grep -q 'clipFeederArgsR701' "$TMP" || { echo 'СТОП: clip feeder отсутствует.'; exit 3; }
grep -q "'-progress','pipe:4'" "$TMP" || { echo 'СТОП: clip progress watchdog input отсутствует.'; exit 3; }
grep -q "progress-stall" "$TMP" || { echo 'СТОП: clip stall watchdog отсутствует.'; exit 3; }
grep -q "stalled >2.2s" "$TMP" || { echo 'СТОП: быстрый stall cut отсутствует.'; exit 3; }
grep -q "scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos" "$TMP" || { echo 'СТОП: FULL-FRAME FIT отсутствует.'; exit 3; }
grep -q "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black" "$TMP" || { echo 'СТОП: safe FIT pad отсутствует.'; exit 3; }
grep -q 'DejaVuSansCondensed-BoldOblique.ttf' "$TMP" || { echo 'СТОП: metal title font отсутствует.'; exit 3; }
grep -q 'box=1:boxcolor=black@0.36:boxborderw=18' "$TMP" || { echo 'СТОП: компактная title-плашка отсутствует.'; exit 3; }
grep -q 'never allow two video clips back-to-back' "$TMP" || { echo 'СТОП: защита от двух клипов подряд отсутствует.'; exit 3; }
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$TMP"; then
  echo 'СТОП: найден cover-crop — эфир не трогаю.'
  exit 3
fi
if grep -q 'stopMasterForClip' "$TMP"; then
  echo 'СТОП: найден старый разрыв YouTube publisher на клипе.'
  exit 3
fi

echo '[2/5] Резервная копия текущего server.mjs…'
cp -a "$SERVER" "$BACKUP"
install -m 0644 "$TMP" "$SERVER"
node --check "$SERVER" >/dev/null

echo '[3/5] Перезапускаю зависший эфир один раз в новую архитектуру R701…'
rollback(){
  echo 'R701 не подтвердился — возвращаю предыдущий server.mjs.'
  cp -f "$BACKUP" "$SERVER" || true
  systemctl restart "$SERVICE" || true
}
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi

echo '[4/5] Жду R701…'
STATUS=''
for i in $(seq 1 20); do
  sleep 2
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | grep -q 'R701-R2-RADIO-CLIPS-PERSISTENT-PUBLISHER'; then break; fi
done
if ! printf '%s' "$STATUS" | grep -q 'R701-R2-RADIO-CLIPS-PERSISTENT-PUBLISHER'; then
  echo 'R701 не подтвердился за 40 секунд.'
  systemctl status "$SERVICE" --no-pager -l | tail -n 35 || true
  rollback
  exit 5
fi

echo '[5/5] Проверка…'
printf '%s\n' "$STATUS"
png_ok "$QR" || { echo 'СТОП: QR перестал быть PNG'; rollback; exit 6; }

echo
echo 'ГОТОВО ✅ R701 активен.'
echo '✅ YouTube RTMPS теперь один и не закрывается на границах MP3/клипов.'
echo '✅ Клип больше не отдельный publisher: это локальный A/V feeder внутри постоянного эфира.'
echo '✅ Если клип перестал выдавать кадры/звук в середине — watchdog ждёт ~2.2 с и принудительно переходит к MP3.'
echo '✅ По окончании клипа обычный radio visual возвращается без переподключения к YouTube.'
echo '✅ FULL-FRAME FIT 1920×1080, без auto-crop и без растягивания.'
echo '✅ Два клипа подряд запрещены; между ними остаётся MP3.'
echo '✅ Metal title, компактная чёрная плашка, QR, ticker, JOY OF BEING, R2 clips и DAY/EVENING/NIGHT сохранены.'

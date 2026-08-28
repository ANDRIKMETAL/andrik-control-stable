#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_DIR="$(mktemp -d /tmp/andrik-r731.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

for c in curl node python3 systemctl ffmpeg; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/7] Загружаю R731: FFMPEG PREVIOUS/NEXT + STABLE BUFFER + VISIBLE FADE…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r731-$(date +%s)" -o "$TMP_DIR/server.mjs"
node --check "$TMP_DIR/server.mjs" >/dev/null

echo '[2/7] Проверяю R731 guards…'
grep -Fq "R731-FFMPEG-PREVNEXT-STABLE-BUFFER-FADE-R730-PRESERVED" "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R731'; exit 3; }
grep -Fq "MEDIA_INPUT_QUEUE_PACKETS_R731 = 8192" "$TMP_DIR/server.mjs" || { echo 'СТОП: стабильный master buffer 8192 отсутствует'; exit 3; }
grep -Fq "FFMPEG_PREVIEW_WINDOW_R731" "$TMP_DIR/server.mjs" || { echo 'СТОП: FFmpeg preview timing marker отсутствует'; exit 3; }
grep -Fq "VIDEO_FADE_SECONDS_R726 = 1.25" "$TMP_DIR/server.mjs" || { echo 'СТОП: заметный 1.25s fade отсутствует'; exit 3; }
grep -Fq "PREVIOUS • ANDRIK —" "$TMP_DIR/server.mjs" || { echo 'СТОП: PREVIOUS label отсутствует'; exit 3; }
grep -Fq "NEXT • ANDRIK —" "$TMP_DIR/server.mjs" || { echo 'СТОП: NEXT label отсутствует'; exit 3; }
grep -Fq "titleOverlayFiltersR721({dynamicTitle:false,showPreview:true,previewDuration:trackDuration})" "$TMP_DIR/server.mjs" || { echo 'СТОП: track overlay не привязан к FFmpeg t'; exit 3; }
grep -Fq "clipBoundaryReconnect:false" "$TMP_DIR/server.mjs" || { echo 'СТОП: ONE RTMPS guard потерян'; exit 3; }
grep -Fq "loudnorm=I=" "$TMP_DIR/server.mjs" || { echo 'СТОП: −14 LUFS потерян'; exit 3; }
grep -Fq "BUMPER_MIN_SONGS_R724 = 4" "$TMP_DIR/server.mjs" || { echo 'СТОП: заставки 4–6 потеряны'; exit 3; }
grep -Fq "SPECIAL_HOURLY_INTERVAL_MS_R727" "$TMP_DIR/server.mjs" || { echo 'СТОП: часовая спецвставка потеряна'; exit 3; }

echo '[3/7] Проверяю drawtext enable=between синтаксис FFmpeg…'
TD="$TMP_DIR/filter-test"; mkdir -p "$TD"
printf 'ANDRIK — TEST\n' > "$TD/current.txt"
printf 'PREVIOUS • ANDRIK — OLD\n' > "$TD/prev.txt"
printf 'NEXT • ANDRIK — NEW\n' > "$TD/next.txt"
ffmpeg -hide_banner -loglevel error -f lavfi -i color=c=black:s=640x360:r=25:d=1 \
  -vf "drawtext=textfile='$TD/current.txt':fontcolor=white:fontsize=20:x=20:y=220,drawtext=textfile='$TD/prev.txt':fontcolor=white:fontsize=16:x=20:y=170:enable='between(t,0.10,0.80)',drawtext=textfile='$TD/next.txt':fontcolor=white:fontsize=16:x=w-text_w-20:y=170:enable='between(t,0.10,0.80)'" \
  -frames:v 5 -f null - >/dev/null 2>&1 || { echo 'СТОП: FFmpeg drawtext preview filter не прошёл'; exit 3; }

TS="$(date +%Y%m%d-%H%M%S)"
echo '[4/7] Резервная копия текущего движка…'
cp -a "$SERVER" "$SERVER.bak-r731-$TS"

echo '[5/7] Ставлю R731…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"

echo '[6/7] Один restart радио для нового FFmpeg UI clock…'
systemctl restart "$SERVICE"
sleep 8
systemctl is-active --quiet "$SERVICE" || { journalctl -u "$SERVICE" -n 180 --no-pager || true; exit 4; }

echo '[7/7] Проверяю реальный status…'
STATUS=''; OK=0
for i in $(seq 1 35); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("version")=="R731-FFMPEG-PREVNEXT-STABLE-BUFFER-FADE-R730-PRESERVED" and d.get("publisherRunning") and d.get("clipBoundaryReconnect") is False and d.get("mediaInputQueuePackets")==8192 and d.get("titleHandoffDelayMs")==0 and abs(float(d.get("videoFadeSeconds",0))-1.25)<0.01 and d.get("trackUiClock")=="ffmpeg-frame-bound-R731" and d.get("nextPreviewTiming")=="FFMPEG_PREVIEW_WINDOW_R731" else 1)' 2>/dev/null; then OK=1; break; fi
  sleep 2
done
[ "$OK" = 1 ] || { echo 'R731 не подтвердил status.'; printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true; journalctl -u "$SERVICE" -n 200 --no-pager || true; exit 5; }

printf '%s\n' "$STATUS" | python3 -m json.tool

echo
echo '========================================================'
echo '✅ R731 ГОТОВ'
echo '✅ master input queues снова 8192 — стабильность R721 возвращена'
echo '✅ CURRENT загружается статично на каждый новый MP3'
echo '✅ PREVIOUS слева + NEXT справа рисует САМ FFmpeg ровно последние 8 секунд'
echo '✅ никаких Node-таймеров для появления PREVIOUS/NEXT'
echo '✅ PREVIOUS/NEXT остаются до T−0.30s и не мелькают'
echo '✅ video fade: 1.25 сек в BLACK → следующий трек 1.25 сек из BLACK'
echo '✅ −14 LUFS / спец 30+60 / заставки 4–6 / QR / CTA / EQ сохранены'
echo '✅ ONE RTMPS сохранён'
echo '========================================================'

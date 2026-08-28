#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_DIR="$(mktemp -d /tmp/andrik-r732.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

for c in curl node python3 systemctl ffmpeg journalctl; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/8] Загружаю R732: R729 transport + TITLE LOCK + PREVIOUS/NEXT + NO ARGB…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r732-$(date +%s)" -o "$TMP_DIR/server.mjs"
node --check "$TMP_DIR/server.mjs" >/dev/null

echo '[2/8] Проверяю R732 guards…'
grep -Fq "R732-R729-TRANSPORT-TITLE-LOCK-PREVNEXT-NO-ARGB" "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R732'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP_DIR/server.mjs" || { echo 'СТОП: R729 video queue 1024 отсутствует'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP_DIR/server.mjs" || { echo 'СТОП: bounded PCM queue 8 отсутствует'; exit 3; }
grep -Fq "FFMPEG_PREVIEW_WINDOW_R732" "$TMP_DIR/server.mjs" || { echo 'СТОП: PREVIOUS/NEXT FFmpeg window отсутствует'; exit 3; }
grep -Fq "PREVIOUS • ANDRIK —" "$TMP_DIR/server.mjs" || { echo 'СТОП: PREVIOUS label отсутствует'; exit 3; }
grep -Fq "NEXT • ANDRIK —" "$TMP_DIR/server.mjs" || { echo 'СТОП: NEXT label отсутствует'; exit 3; }
grep -Fq "VIDEO_FADE_SECONDS_R726 = 1.25" "$TMP_DIR/server.mjs" || { echo 'СТОП: 1.25s fade отсутствует'; exit 3; }
grep -Fq "loudnorm=I=" "$TMP_DIR/server.mjs" || { echo 'СТОП: -14 LUFS loudnorm потерян'; exit 3; }
grep -Fq "SPECIAL_HOURLY_INTERVAL_MS_R727" "$TMP_DIR/server.mjs" || { echo 'СТОП: спецвставка 60 мин потеряна'; exit 3; }
grep -Fq "clipBoundaryReconnect:false" "$TMP_DIR/server.mjs" || { echo 'СТОП: ONE RTMPS guard потерян'; exit 3; }
if grep -Eq 'format=argb|format=rgba|format=auto' "$TMP_DIR/server.mjs"; then
  echo 'СТОП: найден старый RGB/ARGB overlay path'
  exit 3
fi

echo '[3/8] Проверяю YUV420 overlay и FFmpeg PREVIOUS/NEXT синтаксис…'
TD="$TMP_DIR/filter-test"; mkdir -p "$TD"
printf 'ANDRIK — TEST\n' > "$TD/current.txt"
printf 'PREVIOUS • ANDRIK — OLD\n' > "$TD/prev.txt"
printf 'NEXT • ANDRIK — NEW\n' > "$TD/next.txt"
ffmpeg -hide_banner -loglevel warning \
  -f lavfi -i color=c=black:s=640x360:r=25:d=1 \
  -f lavfi -i color=c=white@0.30:s=180x40:r=25:d=1,format=yuva420p \
  -filter_complex "[0:v]format=yuv420p,drawtext=textfile='$TD/current.txt':fontcolor=white:fontsize=20:x=20:y=220,drawtext=textfile='$TD/prev.txt':fontcolor=white:fontsize=16:x=20:y=170:enable='between(t,0.10,0.80)',drawtext=textfile='$TD/next.txt':fontcolor=white:fontsize=16:x=w-text_w-20:y=170:enable='between(t,0.10,0.80)'[b];[b][1:v]overlay=x=20:y=20:format=yuv420[out]" \
  -map '[out]' -frames:v 10 -f null - 2>"$TD/ffmpeg.log" || { cat "$TD/ffmpeg.log"; echo 'СТОП: FFmpeg filter test failed'; exit 3; }
if grep -q 'No accelerated colorspace conversion found from yuv420p to argb' "$TD/ffmpeg.log"; then
  cat "$TD/ffmpeg.log"
  echo 'СТОП: тест всё ещё вызывает yuv420p->argb'
  exit 3
fi

echo '[4/8] Делаю резервную копию…'
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$SERVER.bak-r732-$TS"
cp -a "$SERVER" "$BACKUP"

rollback(){
  echo '⚠️ R732 не прошёл проверку — возвращаю предыдущий server.mjs…'
  cp -a "$BACKUP" "$SERVER"
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[5/8] Ставлю R732…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"

START_TS="$(date --iso-8601=seconds)"
echo '[6/8] Один restart радио для нового транспортного профиля…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 8
if ! systemctl is-active --quiet "$SERVICE"; then journalctl -u "$SERVICE" -n 180 --no-pager || true; rollback; exit 4; fi

echo '[7/8] Проверяю реальный status…'
STATUS=''; OK=0
for i in $(seq 1 35); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("version")=="R732-R729-TRANSPORT-TITLE-LOCK-PREVNEXT-NO-ARGB" and d.get("publisherRunning") and d.get("videoFeederRunning") and d.get("clipBoundaryReconnect") is False and d.get("videoInputQueuePackets")==1024 and d.get("audioInputQueuePackets")==8 and d.get("titleHandoffDelayMs")==0 and d.get("nextPreviewTiming")=="FFMPEG_PREVIEW_WINDOW_R732" and d.get("overlayPixelPath")=="YUV420-NO-ARGB-R732" and abs(float(d.get("videoFadeSeconds",0))-1.25)<0.01 else 1)' 2>/dev/null; then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo 'R732 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  journalctl -u "$SERVICE" -n 220 --no-pager || true
  rollback
  exit 5
fi

echo '[8/8] Проверяю, что ARGB warning не вернулся после запуска…'
RECENT="$(journalctl -u "$SERVICE" --since "$START_TS" --no-pager 2>/dev/null || true)"
if printf '%s' "$RECENT" | grep -q 'No accelerated colorspace conversion found from yuv420p to argb'; then
  echo 'СТОП: после запуска снова найден yuv420p->argb warning'
  printf '%s\n' "$RECENT" | grep -F 'No accelerated colorspace conversion found from yuv420p to argb' | tail -20
  rollback
  exit 6
fi

printf '%s\n' "$STATUS" | python3 -m json.tool

echo
echo '========================================================'
echo '✅ R732 ГОТОВ'
echo '✅ H264 input queue = 1024 (стабильный R729/R721 профиль)'
echo '✅ PCM input queue = 8 (~0.75 s FFmpeg raw cushion; около 1 s с pipe вместо десятков секунд)'
echo '✅ CURRENT не должен перескакивать на 20–30 секунд раньше аудио'
echo '✅ PREVIOUS слева + NEXT справа: FFmpeg T−8.0s → T−0.30s'
echo '✅ Fade: 1.25 s в BLACK + 1.25 s из BLACK'
echo '✅ EQ / QR / CTA: YUV420, старый yuv420p→argb путь удалён'
echo '✅ −14 LUFS / 30+60 min specials / bumpers 4–6 / anti-repeat preserved'
echo '✅ ONE RTMPS preserved'
echo '========================================================'

#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-r737.XXXXXX.mjs)"
BACKUP="${SERVER}.bak-before-r737-$(date +%Y%m%d-%H%M%S)"
trap 'rm -f "$TMP"' EXIT

for c in curl node python3 systemctl; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/7] Скачиваю R737 SAFE ALPHA OVERLAY…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r737-$(date +%s)" -o "$TMP"

echo '[2/7] Проверяю R737 и стабильный транспорт…'
node --check "$TMP" >/dev/null
grep -Fq "R737-SAFE-ALPHA-OVERLAY-FADE-R736-PRESERVED" "$TMP" || { echo 'СТОП: скачался не R737'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP" || { echo 'СТОП: video queue изменена'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP" || { echo 'СТОП: audio queue изменена'; exit 3; }
grep -Fq "VIDEO_FADE_LEAD_SECONDS_R735 = 2.40" "$TMP" || { echo 'СТОП: lead 2.40 потерян'; exit 3; }
grep -Fq "color=c=black@1.0" "$TMP" || { echo 'СТОП: alpha mask source отсутствует'; exit 3; }
grep -Fq "alpha=1[blackmask]" "$TMP" || { echo 'СТОП: alpha fade mask отсутствует'; exit 3; }
grep -Fq "videoBaseNeverFaded:true" "$TMP" || { echo 'СТОП: base-video safety guard отсутствует'; exit 3; }
grep -Fq "BLACK_ALPHA_ONLY_R737" "$TMP" || { echo 'СТОП: R737 overlay guard отсутствует'; exit 3; }
grep -Fq "predictedImmediateNextR736" "$TMP" || { echo 'СТОП: actual NEXT predictor потерян'; exit 3; }
grep -Fq 'NEXT • КЛИП •' "$TMP" || { echo 'СТОП: NEXT clip label потерян'; exit 3; }
grep -Fq "R735-WALLCLOCK-SEEK-CONTINUITY" "$TMP" || { echo 'СТОП: video continuity потеряна'; exit 3; }
grep -Fq "clipBoundaryReconnect:false" "$TMP" || { echo 'СТОП: ONE RTMPS guard потерян'; exit 3; }

echo '[3/7] Проверяю саму alpha-mask схему FFmpeg…'
ffmpeg -hide_banner -loglevel error \
  -f lavfi -i 'color=c=white:s=320x180:r=25:d=3' \
  -filter_complex "color=c=black@1.0:s=320x180:r=25,format=yuva420p,fade=t=in:st=0.500:d=0.65:alpha=1,fade=t=out:st=1.200:d=0.30:alpha=1[blackmask];[0:v][blackmask]overlay=x=0:y=0:shortest=1:format=yuv420[outv]" \
  -map '[outv]' -t 2.5 -f null - >/dev/null 2>&1 || { echo 'СТОП: FFmpeg alpha-mask test не прошёл'; exit 3; }

echo '[4/7] Backup текущего двигателя…'
cp -a "$SERVER" "$BACKUP"

rollback(){
  echo '⚠️ R737 не прошёл запуск — возвращаю предыдущий server.mjs…'
  cp -a "$BACKUP" "$SERVER"
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[5/7] Устанавливаю R737. Звук / 1024-8 / publisher НЕ меняются…'
install -m 0644 "$TMP" "$SERVER"

echo '[6/7] Один restart радио…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 8
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[7/7] Проверяю status…'
STATUS=''; OK=0
for i in $(seq 1 25); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); ok=(d.get("version")=="R737-SAFE-ALPHA-OVERLAY-FADE-R736-PRESERVED" and d.get("publisherRunning") and d.get("producerRunning") and d.get("videoInputQueuePackets")==1024 and d.get("audioInputQueuePackets")==8 and d.get("videoFadeStrategy")=="SAFE_BLACK_ALPHA_MASK_R737" and d.get("videoBaseNeverFaded") is True and d.get("videoOverlayMask")=="BLACK_ALPHA_ONLY_R737" and d.get("nextPreviewSource")=="ACTUAL_IMMEDIATE_ITEM_R737" and d.get("visualContinuityMode")=="R735-WALLCLOCK-SEEK-CONTINUITY"); raise SystemExit(0 if ok else 1)' 2>/dev/null; then
    OK=1
    break
  fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R737 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

printf '%s\n' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("VERSION:",d.get("version")); print("PUBLISHER:",d.get("publisherRunning")); print("PRODUCER:",d.get("producerRunning")); print("VIDEO QUEUE:",d.get("videoInputQueuePackets")); print("AUDIO QUEUE:",d.get("audioInputQueuePackets")); print("FADE STRATEGY:",d.get("videoFadeStrategy")); print("BASE VIDEO NEVER FADED:",d.get("videoBaseNeverFaded")); print("MASK:",d.get("videoOverlayMask")); print("NEXT SOURCE:",d.get("nextPreviewSource")); print("VISUAL CONTINUITY:",d.get("visualContinuityMode"))'

echo
echo '========================================================'
echo '✅ R737 ГОТОВ'
echo '✅ Главный видеоряд НИКОГДА не проходит через fade filter'
echo '✅ Затемнение = отдельная чёрная ALPHA-маска поверх живой картинки'
echo '✅ Маска: 0.65s IN -> 0.05s BLACK -> 0.30s OUT'
echo '✅ После маски исходное видео остаётся живым — permanent black невозможен'
echo '✅ Стабильный транспорт сохранён: VIDEO 1024 / AUDIO 8'
echo '✅ NEXT = фактически следующий MP3 / КЛИП / SPECIAL / BUMPER'
echo '✅ Фоновый видеоряд продолжает позицию R735'
echo '✅ ONE RTMPS сохранён'
echo '========================================================'

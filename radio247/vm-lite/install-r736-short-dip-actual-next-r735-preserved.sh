#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-r736.XXXXXX.mjs)"
BACKUP="${SERVER}.bak-before-r736-$(date +%Y%m%d-%H%M%S)"
trap 'rm -f "$TMP"' EXIT

for c in curl node python3 systemctl; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/6] Скачиваю R736…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r736-$(date +%s)" -o "$TMP"

echo '[2/6] Проверяю R736 и стабильный транспорт…'
node --check "$TMP" >/dev/null
grep -Fq "R736-SHORT-DIP-ACTUAL-NEXT-R735-PRESERVED" "$TMP" || { echo 'СТОП: скачался не R736'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP" || { echo 'СТОП: video queue R732 изменена'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP" || { echo 'СТОП: audio queue R732 изменена'; exit 3; }
grep -Fq "VIDEO_FADE_LEAD_SECONDS_R735 = 2.40" "$TMP" || { echo 'СТОП: правильный lead 2.40 потерян'; exit 3; }
grep -Fq "VIDEO_FADE_SECONDS_R726 = 0.65" "$TMP" || { echo 'СТОП: короткий fade-out 0.65 отсутствует'; exit 3; }
grep -Fq "VIDEO_FADE_IN_SECONDS_R736 = 0.30" "$TMP" || { echo 'СТОП: recovery fade-in 0.30 отсутствует'; exit 3; }
grep -Fq "VIDEO_BLACK_HOLD_SECONDS_R736 = 0.05" "$TMP" || { echo 'СТОП: black hold 0.05 отсутствует'; exit 3; }
grep -Fq "predictedImmediateNextR736" "$TMP" || { echo 'СТОП: actual NEXT predictor отсутствует'; exit 3; }
grep -Fq 'NEXT • КЛИП •' "$TMP" || { echo 'СТОП: NEXT clip label отсутствует'; exit 3; }
grep -Fq "R735-WALLCLOCK-SEEK-CONTINUITY" "$TMP" || { echo 'СТОП: continuity R735 потеряна'; exit 3; }
grep -Fq "clipBoundaryReconnect:false" "$TMP" || { echo 'СТОП: ONE RTMPS guard потерян'; exit 3; }

echo '[3/6] Backup текущего двигателя…'
cp -a "$SERVER" "$BACKUP"

rollback(){
  echo '⚠️ R736 не прошёл запуск — возвращаю предыдущий server.mjs…'
  cp -a "$BACKUP" "$SERVER"
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[4/6] Устанавливаю R736. Звук/очереди/publisher НЕ меняются…'
install -m 0644 "$TMP" "$SERVER"

echo '[5/6] Один restart радио…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 8
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[6/6] Проверяю status…'
STATUS=''; OK=0
for i in $(seq 1 25); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); ok=(d.get("version")=="R736-SHORT-DIP-ACTUAL-NEXT-R735-PRESERVED" and d.get("publisherRunning") and d.get("producerRunning") and d.get("videoInputQueuePackets")==1024 and d.get("audioInputQueuePackets")==8 and d.get("videoFadeStrategy")=="SHORT_BOUNDARY_DIP_R736" and abs(float(d.get("videoFadeSeconds",0))-0.65)<0.01 and abs(float(d.get("videoFadeInSeconds",0))-0.30)<0.01 and abs(float(d.get("videoBlackHoldSeconds",0))-0.05)<0.01 and d.get("nextPreviewSource")=="ACTUAL_IMMEDIATE_ITEM_R736" and d.get("visualContinuityMode")=="R735-WALLCLOCK-SEEK-CONTINUITY"); raise SystemExit(0 if ok else 1)' 2>/dev/null; then
    OK=1
    break
  fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R736 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

printf '%s\n' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("VERSION:",d.get("version")); print("PUBLISHER:",d.get("publisherRunning")); print("PRODUCER:",d.get("producerRunning")); print("VIDEO QUEUE:",d.get("videoInputQueuePackets")); print("AUDIO QUEUE:",d.get("audioInputQueuePackets")); print("FADE OUT:",d.get("videoFadeSeconds")); print("BLACK HOLD:",d.get("videoBlackHoldSeconds")); print("FADE RECOVERY:",d.get("videoFadeInSeconds")); print("NEXT SOURCE:",d.get("nextPreviewSource")); print("VISUAL CONTINUITY:",d.get("visualContinuityMode"))'

echo
echo '========================================================'
echo '✅ R736 ГОТОВ'
echo '✅ Стабильный транспорт сохранён: VIDEO 1024 / AUDIO 8'
echo '✅ Fade start lead 2.40s сохранён'
echo '✅ Переход: 0.65s OUT -> 0.05s BLACK -> 0.30s recovery'
echo '✅ Долгого чёрного экрана на начале новой песни больше быть не должно'
echo '✅ NEXT = фактически следующий элемент: MP3 / КЛИП / SPECIAL / BUMPER'
echo '✅ Фоновый видеоряд продолжает позицию R735'
echo '✅ ONE RTMPS сохранён'
echo '========================================================'

#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-r734.XXXXXX.mjs)"
BACKUP="${SERVER}.bak-before-r734-$(date +%Y%m%d-%H%M%S)"
trap 'rm -f "$TMP"' EXIT

for c in curl node python3 systemctl; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/6] Скачиваю R734…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r734-$(date +%s)" -o "$TMP"

echo '[2/6] Проверяю код и сохранность транспорта R732…'
node --check "$TMP" >/dev/null
grep -Fq "R734-BOUNDARY-FADEOUT-NO-LATE-FADEIN-R733-PRESERVED" "$TMP" || { echo 'СТОП: скачался не R734'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP" || { echo 'СТОП: video queue R732 изменена'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP" || { echo 'СТОП: audio queue R732 изменена'; exit 3; }
grep -Fq "VIDEO_BLACK_HOLD_SECONDS_R734 = 0.20" "$TMP" || { echo 'СТОП: black hold R734 отсутствует'; exit 3; }
grep -Fq "fadeIn:false,trackDuration:duration" "$TMP" || { echo 'СТОП: late fade-in не отключён'; exit 3; }
grep -Fq "previousTrackFallbackR733" "$TMP" || { echo 'СТОП: PREVIOUS fallback потерян'; exit 3; }
grep -Fq "clipBoundaryReconnect:false" "$TMP" || { echo 'СТОП: ONE RTMPS guard потерян'; exit 3; }

echo '[3/6] Backup текущего двигателя…'
cp -a "$SERVER" "$BACKUP"

rollback(){
  echo '⚠️ R734 не прошёл запуск — возвращаю предыдущий server.mjs…'
  cp -a "$BACKUP" "$SERVER"
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[4/6] Устанавливаю R734. Звук/очереди/publisher НЕ меняются…'
install -m 0644 "$TMP" "$SERVER"

echo '[5/6] Один restart радио…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 8
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[6/6] Проверяю status…'
STATUS=''; OK=0
for i in $(seq 1 25); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); ok=(d.get("version")=="R734-BOUNDARY-FADEOUT-NO-LATE-FADEIN-R733-PRESERVED" and d.get("publisherRunning") and d.get("producerRunning") and d.get("videoInputQueuePackets")==1024 and d.get("audioInputQueuePackets")==8 and d.get("videoFadeStrategy")=="OLD_TRACK_ONLY_R734" and d.get("videoFadeInEnabled") is False and abs(float(d.get("videoBlackHoldSeconds",0))-0.20)<0.01 and d.get("previousPreviewFallback")=="MEMORY-PREVIOUS-OR-CURRENT-FILE-R733"); raise SystemExit(0 if ok else 1)' 2>/dev/null; then
    OK=1
    break
  fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R734 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

printf '%s\n' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("VERSION:",d.get("version")); print("PUBLISHER:",d.get("publisherRunning")); print("PRODUCER:",d.get("producerRunning")); print("VIDEO QUEUE:",d.get("videoInputQueuePackets")); print("AUDIO QUEUE:",d.get("audioInputQueuePackets")); print("FADE STRATEGY:",d.get("videoFadeStrategy")); print("FADE-IN:",d.get("videoFadeInEnabled")); print("BLACK HOLD:",d.get("videoBlackHoldSeconds")); print("PREVIOUS:",d.get("previousPreviewFallback"))'

echo
echo '========================================================'
echo '✅ R734 ГОТОВ'
echo '✅ Транспорт R732 сохранён: video queue 1024 / audio queue 8'
echo '✅ Fade-in новой песни ОТКЛЮЧЁН — позднего затемнения после старта быть не может'
echo '✅ Старый трек: 1.25s fade-to-black + 0.20s full-black до границы'
echo '✅ CURRENT / PREVIOUS / NEXT из R733 сохранены'
echo '✅ ONE RTMPS / loudness / specials / bumpers сохранены'
echo '========================================================'

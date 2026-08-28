#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-r735.XXXXXX.mjs)"
BACKUP="${SERVER}.bak-before-r735-$(date +%Y%m%d-%H%M%S)"
trap 'rm -f "$TMP"' EXIT

for c in curl node python3 systemctl; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/6] Скачиваю R735…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r735-$(date +%s)" -o "$TMP"

echo '[2/6] Проверяю код и что стабильный транспорт R732 не изменён…'
node --check "$TMP" >/dev/null
grep -Fq "R735-EARLY-FADE-CONTINUOUS-VISUAL-R734-PRESERVED" "$TMP" || { echo 'СТОП: скачался не R735'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP" || { echo 'СТОП: video queue R732 изменена'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP" || { echo 'СТОП: audio queue R732 изменена'; exit 3; }
grep -Fq "VIDEO_FADE_LEAD_SECONDS_R735 = 2.40" "$TMP" || { echo 'СТОП: ранний fade R735 отсутствует'; exit 3; }
grep -Fq "visualLoopOffsetR735" "$TMP" || { echo 'СТОП: continuity R735 отсутствует'; exit 3; }
grep -Fq "R735-WALLCLOCK-SEEK-CONTINUITY" "$TMP" || { echo 'СТОП: continuity mode R735 отсутствует'; exit 3; }
grep -Fq "fadeIn:false,trackDuration:duration" "$TMP" || { echo 'СТОП: late fade-in снова включён'; exit 3; }
grep -Fq "previousTrackFallbackR733" "$TMP" || { echo 'СТОП: PREVIOUS fallback потерян'; exit 3; }
grep -Fq "clipBoundaryReconnect:false" "$TMP" || { echo 'СТОП: ONE RTMPS guard потерян'; exit 3; }

echo '[3/6] Backup текущего двигателя…'
cp -a "$SERVER" "$BACKUP"

rollback(){
  echo '⚠️ R735 не прошёл запуск — возвращаю предыдущий server.mjs…'
  cp -a "$BACKUP" "$SERVER"
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[4/6] Устанавливаю R735. Звук/очереди/publisher НЕ меняются…'
install -m 0644 "$TMP" "$SERVER"

echo '[5/6] Один restart радио…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 8
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[6/6] Проверяю status…'
STATUS=''; OK=0
for i in $(seq 1 25); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); ok=(d.get("version")=="R735-EARLY-FADE-CONTINUOUS-VISUAL-R734-PRESERVED" and d.get("publisherRunning") and d.get("producerRunning") and d.get("videoInputQueuePackets")==1024 and d.get("audioInputQueuePackets")==8 and d.get("videoFadeStrategy")=="OLD_TRACK_EARLY_LEAD_R735" and abs(float(d.get("videoFadeLeadSeconds",0))-2.40)<0.01 and d.get("videoFadeInEnabled") is False and d.get("visualContinuityMode")=="R735-WALLCLOCK-SEEK-CONTINUITY"); raise SystemExit(0 if ok else 1)' 2>/dev/null; then
    OK=1
    break
  fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R735 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

printf '%s\n' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("VERSION:",d.get("version")); print("PUBLISHER:",d.get("publisherRunning")); print("PRODUCER:",d.get("producerRunning")); print("VIDEO QUEUE:",d.get("videoInputQueuePackets")); print("AUDIO QUEUE:",d.get("audioInputQueuePackets")); print("FADE LEAD:",d.get("videoFadeLeadSeconds")); print("FADE-IN:",d.get("videoFadeInEnabled")); print("VISUAL CONTINUITY:",d.get("visualContinuityMode")); print("VISUAL OFFSET:",d.get("visualLoopOffsetSeconds"))'

echo
echo '========================================================'
echo '✅ R735 ГОТОВ'
echo '✅ Транспорт R732 сохранён: video queue 1024 / audio queue 8'
echo '✅ Затемнение старого трека рассчитано на 2.40s раньше'
echo '✅ Новый трек НЕ имеет позднего fade-in'
echo '✅ Фоновый MORNING/DAY/EVENING/NIGHT MP4 больше не возвращается на 0:00 при каждой песне'
echo '✅ NEXT / PREVIOUS / current title сохранены'
echo '✅ ONE RTMPS / loudness / specials / bumpers сохранены'
echo '========================================================'

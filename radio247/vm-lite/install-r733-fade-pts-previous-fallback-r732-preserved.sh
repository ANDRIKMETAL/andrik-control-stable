#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-r733.XXXXXX.mjs)"
BACKUP="${SERVER}.bak-before-r733-$(date +%Y%m%d-%H%M%S)"
trap 'rm -f "$TMP"' EXIT

for c in curl node python3 systemctl; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/6] Скачиваю R733…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r733-$(date +%s)" -o "$TMP"

echo '[2/6] Проверяю код и guards…'
node --check "$TMP" >/dev/null
grep -Fq "R733-FADE-PTS-PREVIOUS-FALLBACK-R732-PRESERVED" "$TMP" || { echo 'СТОП: скачался не R733'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP" || { echo 'СТОП: video queue R732 изменена'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP" || { echo 'СТОП: audio queue R732 изменена'; exit 3; }
grep -Fq "setpts=PTS-STARTPTS" "$TMP" || { echo 'СТОП: PTS anchor R733 отсутствует'; exit 3; }
grep -Fq "previousTrackFallbackR733" "$TMP" || { echo 'СТОП: PREVIOUS fallback R733 отсутствует'; exit 3; }
grep -Fq "VIDEO_FADE_SECONDS_R726 = 1.25" "$TMP" || { echo 'СТОП: fade 1.25s потерян'; exit 3; }
grep -Fq "clipBoundaryReconnect:false" "$TMP" || { echo 'СТОП: ONE RTMPS guard потерян'; exit 3; }

echo '[3/6] Backup текущего двигателя…'
cp -a "$SERVER" "$BACKUP"

rollback(){
  echo '⚠️ R733 не прошёл запуск — возвращаю предыдущий server.mjs…'
  cp -a "$BACKUP" "$SERVER"
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[4/6] Устанавливаю R733 (транспорт R732 не меняется)…'
install -m 0644 "$TMP" "$SERVER"

 echo '[5/6] Один restart радио…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 8
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[6/6] Проверяю status…'
STATUS=''; OK=0
for i in $(seq 1 25); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); ok=(d.get("version")=="R733-FADE-PTS-PREVIOUS-FALLBACK-R732-PRESERVED" and d.get("publisherRunning") and d.get("producerRunning") and d.get("videoInputQueuePackets")==1024 and d.get("audioInputQueuePackets")==8 and d.get("nextPreviewTiming")=="FFMPEG_PREVIEW_WINDOW_R733_PTS_ANCHORED" and d.get("visualTimelineAnchor")=="PTS-STARTPTS-R733" and d.get("previousPreviewFallback")=="MEMORY-PREVIOUS-OR-CURRENT-FILE-R733" and abs(float(d.get("videoFadeSeconds",0))-1.25)<0.01); raise SystemExit(0 if ok else 1)' 2>/dev/null; then
    OK=1
    break
  fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R733 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

printf '%s\n' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("VERSION:",d.get("version")); print("PUBLISHER:",d.get("publisherRunning")); print("PRODUCER:",d.get("producerRunning")); print("VIDEO QUEUE:",d.get("videoInputQueuePackets")); print("AUDIO QUEUE:",d.get("audioInputQueuePackets")); print("NEXT MODE:",d.get("nextPreviewTiming")); print("PTS:",d.get("visualTimelineAnchor")); print("PREVIOUS:",d.get("previousPreviewFallback")); print("FADE:",d.get("videoFadeSeconds"))'

echo
echo '========================================================'
echo '✅ R733 ГОТОВ'
echo '✅ Транспорт R732 сохранён: video queue 1024 / audio queue 8'
echo '✅ Fade/preview теперь считают время от PTS=0 каждого MP3'
echo '✅ PREVIOUS имеет fallback после restart и после вставок'
echo '✅ NEXT остаётся FFmpeg T−8s → T−0.30s'
echo '✅ Fade остаётся 1.25s BLACK, без изменения звука/сети'
echo '========================================================'

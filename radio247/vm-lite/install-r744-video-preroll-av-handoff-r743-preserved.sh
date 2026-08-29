#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-r744.XXXXXX.mjs)"
BACKUP="${SERVER}.bak-before-r744-$(date +%Y%m%d-%H%M%S)"
TESTDIR="$(mktemp -d /tmp/andrik-r744-test.XXXXXX)"
trap 'rm -f "$TMP"; rm -rf "$TESTDIR"' EXIT

for c in curl node python3 systemctl ffmpeg ffprobe; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/8] Скачиваю R744…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r744-$(date +%s)" -o "$TMP"

echo '[2/8] Проверяю R744 и НЕИЗМЕННЫЙ стабильный транспорт…'
node --check "$TMP" >/dev/null
grep -Fq "R744-VIDEO-PREROLL-AV-HANDOFF-R743-PRESERVED" "$TMP" || { echo 'СТОП: скачался не R744'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP" || { echo 'СТОП: video queue изменена'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP" || { echo 'СТОП: audio queue изменена'; exit 3; }
grep -Fq "TRACK_AUDIO_FADE_OUT_R726 = 1.25" "$TMP" || { echo 'СТОП: audio fade 1.25 потерян'; exit 3; }
grep -Fq "VIDEO_PIPELINE_LEAD_SECONDS_R744" "$TMP" || { echo 'СТОП: video preroll lead отсутствует'; exit 3; }
grep -Fq "clipPreparedVideoOnlyArgsR744" "$TMP" || { echo 'СТОП: video-only preroll отсутствует'; exit 3; }
grep -Fq "clipPreparedAudioOnlyArgsR744" "$TMP" || { echo 'СТОП: audio-at-boundary отсутствует'; exit 3; }
grep -Fq "R744-FEEDER-CLOCK-FINAL-8S-WITH-VIDEO-PREROLL" "$TMP" || { echo 'СТОП: PREVIOUS/NEXT R744 отсутствуют'; exit 3; }
grep -Fq "h264_mp4toannexb" "$TMP" || { echo 'СТОП: prepared H264 copy потерян'; exit 3; }
grep -Fq "clipBoundaryReconnect:false" "$TMP" || { echo 'СТОП: ONE RTMPS guard потерян'; exit 3; }

echo '[3/8] Smoke-test prepared H264/no-B-frame + audio…'
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i 'testsrc2=s=320x180:r=25:d=1' \
  -f lavfi -i 'sine=frequency=660:sample_rate=44100:duration=1' \
  -map 0:v:0 -c:v libx264 -preset ultrafast -tune zerolatency -bf 0 -g 50 -keyint_min 50 -sc_threshold 0 -r 25 -pix_fmt yuv420p -threads 1 \
  -map 1:a:0 -c:a aac -b:a 128k -ar 44100 -ac 2 -t 0.8 "$TESTDIR/ready.mp4"
CODEC="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$TESTDIR/ready.mp4" 2>/dev/null || true)"
BFR="$(ffprobe -v error -select_streams v:0 -show_entries stream=has_b_frames -of default=nw=1:nk=1 "$TESTDIR/ready.mp4" 2>/dev/null || true)"
ACH="$(ffprobe -v error -select_streams a:0 -show_entries stream=channels -of default=nw=1:nk=1 "$TESTDIR/ready.mp4" 2>/dev/null || true)"
[ "$CODEC" = h264 ] || { echo "СТОП: test codec=$CODEC"; exit 3; }
[ "$BFR" = 0 ] || { echo "СТОП: test B-frames=$BFR"; exit 3; }
[ -n "$ACH" ] || { echo 'СТОП: test audio отсутствует'; exit 3; }

echo '[4/8] Проверяю split video/audio чтение…'
ffmpeg -hide_banner -loglevel error -re -i "$TESTDIR/ready.mp4" -map 0:v:0 -an -c:v copy -bsf:v h264_mp4toannexb -t 0.20 -f h264 "$TESTDIR/v.h264"
ffmpeg -hide_banner -loglevel error -re -i "$TESTDIR/ready.mp4" -map 0:a:0 -vn -af 'aresample=44100:async=1:first_pts=0,asetpts=PTS-STARTPTS' -c:a pcm_s16le -ar 44100 -ac 2 -t 0.20 -f s16le "$TESTDIR/a.pcm"
[ -s "$TESTDIR/v.h264" ] || { echo 'СТОП: video-only copy failed'; exit 3; }
[ -s "$TESTDIR/a.pcm" ] || { echo 'СТОП: audio-only boundary failed'; exit 3; }

echo '[5/8] Backup…'
cp -a "$SERVER" "$BACKUP"
rollback(){
  echo '⚠️ R744 не прошёл запуск — возвращаю предыдущий server.mjs…'
  cp -a "$BACKUP" "$SERVER"
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[6/8] Устанавливаю R744…'
install -m 0644 "$TMP" "$SERVER"

echo '[7/8] Один restart радио…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 8
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[8/8] Проверяю status…'
STATUS=''; OK=0
for i in $(seq 1 25); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json, os
try: d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception: raise SystemExit(1)
ok=(
 d.get('version')=='R744-VIDEO-PREROLL-AV-HANDOFF-R743-PRESERVED' and
 d.get('publisherRunning') is True and
 d.get('videoInputQueuePackets')==1024 and
 d.get('audioInputQueuePackets')==8 and
 d.get('audioFadeOutSeconds')==1.25 and
 d.get('nextPreviewTiming')=='R744-FEEDER-CLOCK-FINAL-8S-WITH-VIDEO-PREROLL' and
 d.get('mp3BoundaryMode')=='R744-VIDEO-PREROLL-BOUNDARY' and
 d.get('clipBoundaryReconnect') is False and
 float(d.get('videoPipelineLeadSeconds') or 0)>=2
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R744 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

printf '%s\n' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("VERSION:",d.get("version")); print("PUBLISHER:",d.get("publisherRunning")); print("PRODUCER:",d.get("producerRunning")); print("VIDEO QUEUE:",d.get("videoInputQueuePackets")); print("AUDIO QUEUE:",d.get("audioInputQueuePackets")); print("VIDEO PREROLL:",d.get("videoPipelineLeadSeconds")); print("PREV/NEXT:",d.get("nextPreviewTiming")); print("AUDIO FADE:",d.get("audioFadeOutSeconds")); print("CLIP MODE:",d.get("clipAvSyncMode")); print("LAST ERROR:",d.get("lastError"))'

echo
echo '========================================================'
echo '✅ R744 ГОТОВ'
echo '✅ VIDEO 1024 / AUDIO 8 / ONE RTMPS сохранены'
echo '✅ Видео следующего источника подаётся заранее в video queue'
echo '✅ Звук клипа/заставки стартует только на реальной границе'
echo '✅ PREVIOUS/NEXT = последние 8 секунд у зрителя'
echo '✅ SAFE fade = последние 0.80 сек перед границей'
echo '✅ MP3 audio fade-out = 1.25 сек'
echo '✅ R742 prepared H264 COPY / low CPU сохранён'
echo '========================================================'

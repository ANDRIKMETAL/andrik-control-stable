#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-r743.XXXXXX.mjs)"
BACKUP="${SERVER}.bak-before-r743-$(date +%Y%m%d-%H%M%S)"
TESTDIR="$(mktemp -d /tmp/andrik-r743-test.XXXXXX)"
trap 'rm -f "$TMP"; rm -rf "$TESTDIR"' EXIT

for c in curl node python3 systemctl ffmpeg ffprobe; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/8] Скачиваю R743…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r743-$(date +%s)" -o "$TMP"

echo '[2/8] Проверяю R743 и сохранённый стабильный транспорт…'
node --check "$TMP" >/dev/null
grep -Fq "R743-RESTORE-MP3-BOUNDARY-UI-FADE-R742-PRESERVED" "$TMP" || { echo 'СТОП: скачался не R743'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP" || { echo 'СТОП: video queue изменена'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP" || { echo 'СТОП: audio queue изменена'; exit 3; }
grep -Fq "TRACK_AUDIO_FADE_OUT_R726 = 1.25" "$TMP" || { echo 'СТОП: audio fade 1.25 потерян'; exit 3; }
grep -Fq "VIDEO_FADE_LEAD_SECONDS_R735 = 2.40" "$TMP" || { echo 'СТОП: video fade lead 2.40 потерян'; exit 3; }
grep -Fq "VIDEO_TIMELINE_COMP_DEFAULT_R739 = 0.0" "$TMP" || { echo 'СТОП: глобальная компенсация R739 не отключена'; exit 3; }
grep -Fq "R743-R732-FINAL-8S-NO-GLOBAL-COMP" "$TMP" || { echo 'СТОП: PREVIOUS/NEXT T-8s не восстановлены'; exit 3; }
grep -Fq "NEXT-FEEDER-OWNS-CURRENT-R743" "$TMP" || { echo 'СТОП: CURRENT handoff не восстановлен'; exit 3; }
grep -Fq "h264_mp4toannexb" "$TMP" || { echo 'СТОП: R742 prepared clip COPY потерян'; exit 3; }
grep -Fq "R742-PREPARED-H264-COPY" "$TMP" || { echo 'СТОП: clip copy mode потерян'; exit 3; }
grep -Fq "station insert skipped: audio stream missing" "$TMP" || { echo 'СТОП: silent-insert guard потерян'; exit 3; }
grep -Fq "clipBoundaryReconnect:false" "$TMP" || { echo 'СТОП: ONE RTMPS guard потерян'; exit 3; }

echo '[3/8] Smoke-test H264 COPY path…'
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i 'testsrc2=s=320x180:r=25:d=1' \
  -f lavfi -i 'sine=frequency=660:sample_rate=44100:duration=1' \
  -map 0:v:0 -c:v libx264 -preset ultrafast -tune zerolatency -bf 0 -g 50 -keyint_min 50 -sc_threshold 0 -r 25 -pix_fmt yuv420p -threads 1 \
  -map 1:a:0 -c:a aac -b:a 128k -ar 44100 -ac 2 -t 0.8 "$TESTDIR/ready.mp4"
CODEC="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$TESTDIR/ready.mp4" || true)"
BFR="$(ffprobe -v error -select_streams v:0 -show_entries stream=has_b_frames -of default=nw=1:nk=1 "$TESTDIR/ready.mp4" || true)"
[ "$CODEC" = h264 ] || { echo "СТОП: test codec=$CODEC"; exit 3; }
[ "$BFR" = 0 ] || { echo "СТОП: test B-frames=$BFR"; exit 3; }

echo '[4/8] Smoke-test audio fade 1.25s…'
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i 'sine=frequency=440:sample_rate=44100:duration=2' \
  -af 'afade=t=out:st=0.75:d=1.25,aresample=44100' \
  -c:a pcm_s16le -ar 44100 -ac 2 -f s16le "$TESTDIR/fade.pcm"
[ -s "$TESTDIR/fade.pcm" ] || { echo 'СТОП: audio fade smoke-test failed'; exit 3; }

echo '[5/8] Backup…'
cp -a "$SERVER" "$BACKUP"
rollback(){
  echo '⚠️ R743 не прошёл запуск — возвращаю предыдущий server.mjs…'
  cp -a "$BACKUP" "$SERVER"
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[6/8] Устанавливаю R743…'
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
import json, os, sys
try: d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception: raise SystemExit(1)
ok=(
 d.get('version')=='R743-RESTORE-MP3-BOUNDARY-UI-FADE-R742-PRESERVED' and
 d.get('publisherRunning') is True and
 d.get('videoInputQueuePackets')==1024 and
 d.get('audioInputQueuePackets')==8 and
 d.get('audioFadeOutSeconds')==1.25 and
 d.get('nextPreviewTiming')=='R743-R732-FINAL-8S-NO-GLOBAL-COMP' and
 d.get('mp3BoundaryMode')=='R743-R732-RESTORED' and
 d.get('currentTitleHandoff')=='NEXT-FEEDER-OWNS-CURRENT-R743' and
 d.get('clipPlaybackMode')=='R742-PREPARED-H264-COPY' and
 d.get('clipBoundaryReconnect') is False
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R743 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

printf '%s\n' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("VERSION:",d.get("version")); print("PUBLISHER:",d.get("publisherRunning")); print("PRODUCER:",d.get("producerRunning")); print("VIDEO QUEUE:",d.get("videoInputQueuePackets")); print("AUDIO QUEUE:",d.get("audioInputQueuePackets")); print("PREV/NEXT:",d.get("nextPreviewTiming")); print("AUDIO FADE:",d.get("audioFadeOutSeconds")); print("VIDEO LEAD:",d.get("videoFadeLeadSeconds")); print("CLIP MODE:",d.get("clipPlaybackMode")); print("LAST ERROR:",d.get("lastError"))'

echo
echo '========================================================'
echo '✅ R743 ГОТОВ'
echo '✅ PREVIOUS/NEXT снова: последние 8 секунд текущей MP3'
echo '✅ CURRENT меняется только вместе с feeder следующего трека'
echo '✅ Видео-затемнение: безопасная alpha-mask, lead 2.40 сек'
echo '✅ Аудио fade-out: 1.25 сек'
echo '✅ R739 global 8s compensation отключена для MP3 boundary'
echo '✅ R742 prepared clip COPY / low CPU / A-V lock сохранены'
echo '✅ VIDEO 1024 / AUDIO 8 / ONE RTMPS сохранены'
echo '========================================================'

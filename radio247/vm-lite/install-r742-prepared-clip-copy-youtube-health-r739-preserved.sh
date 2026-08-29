#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-r742.XXXXXX.mjs)"
BACKUP="${SERVER}.bak-before-r742-$(date +%Y%m%d-%H%M%S)"
TESTDIR="$(mktemp -d /tmp/andrik-r742-test.XXXXXX)"
trap 'rm -f "$TMP"; rm -rf "$TESTDIR"' EXIT

for c in curl node python3 systemctl ffmpeg ffprobe nice; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/9] Скачиваю R742…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r742-$(date +%s)" -o "$TMP"

echo '[2/9] Проверяю R742 и НЕИЗМЕННЫЙ стабильный транспорт…'
node --check "$TMP" >/dev/null
grep -Fq "R742-PREPARED-CLIP-COPY-YOUTUBE-HEALTH-R739-PRESERVED" "$TMP" || { echo 'СТОП: скачался не R742'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP" || { echo 'СТОП: video queue изменена'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP" || { echo 'СТОП: audio queue изменена'; exit 3; }
grep -Fq "VIDEO_TIMELINE_COMP_DEFAULT_R739" "$TMP" || { echo 'СТОП: R739 timeline compensation потеряна'; exit 3; }
grep -Fq "CLIP_PREP_NICE_R742 = 12" "$TMP" || { echo 'СТОП: low-priority clip preparation отсутствует'; exit 3; }
grep -Fq "preparedClipSerialR742" "$TMP" || { echo 'СТОП: serial clip preparation отсутствует'; exit 3; }
grep -Fq "'-threads','1'" "$TMP" || { echo 'СТОП: one-thread background prep guard отсутствует'; exit 3; }
grep -Fq "'-filter_complex_threads','1'" "$TMP" || { echo 'СТОП: one-thread filter prep guard отсутствует'; exit 3; }
grep -Fq "h264_mp4toannexb" "$TMP" || { echo 'СТОП: prepared H264 copy path отсутствует'; exit 3; }
grep -Fq "'-c:v','copy'" "$TMP" || { echo 'СТОП: live clip c:v copy отсутствует'; exit 3; }
grep -Fq "R742 clip deferred until prepared cache is ready" "$TMP" || { echo 'СТОП: no-live-reencode defer guard отсутствует'; exit 3; }
grep -Fq "station insert skipped: audio stream missing" "$TMP" || { echo 'СТОП: silent-insert guard потерян'; exit 3; }
grep -Fq "color=c=black@1.0" "$TMP" || { echo 'СТОП: безопасная alpha-mask потеряна'; exit 3; }
grep -Fq "clipBoundaryReconnect:false" "$TMP" || { echo 'СТОП: ONE RTMPS guard потерян'; exit 3; }

echo '[3/9] Проверяю prepared H264: 25fps / no B-frames / AAC…'
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i 'testsrc2=s=320x180:r=25:d=1.2' \
  -f lavfi -i 'sine=frequency=660:sample_rate=44100:duration=1.2' \
  -map 0:v:0 -c:v libx264 -preset ultrafast -tune zerolatency -bf 0 -g 50 -keyint_min 50 -sc_threshold 0 -r 25 -pix_fmt yuv420p -threads 1 \
  -map 1:a:0 -c:a aac -b:a 128k -ar 44100 -ac 2 -t 1.0 "$TESTDIR/ready.mp4"
PROBE="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,avg_frame_rate,has_b_frames -of csv=p=0 "$TESTDIR/ready.mp4")"
printf '%s' "$PROBE" | grep -Fq 'h264' || { echo 'СТОП: prepared codec test не H264'; exit 3; }
printf '%s' "$PROBE" | grep -Fq '25/1' || { echo 'СТОП: prepared fps test не 25fps'; exit 3; }
printf '%s' "$PROBE" | grep -Eq '(^|,)0($|,)' || { echo 'СТОП: prepared B-frame test не 0'; exit 3; }

echo '[4/9] Проверяю low-CPU live COPY + общий A/V clock…'
ffmpeg -hide_banner -loglevel error -re -i "$TESTDIR/ready.mp4" \
  -map 0:v:0 -an -c:v copy -bsf:v h264_mp4toannexb -t 0.6 -f h264 "$TESTDIR/out.h264" \
  -map 0:a:0 -vn -af 'aresample=44100:async=1:first_pts=0,asetpts=PTS-STARTPTS' -c:a pcm_s16le -ar 44100 -ac 2 -t 0.6 -f s16le "$TESTDIR/out.pcm"
[ -s "$TESTDIR/out.h264" ] && [ -s "$TESTDIR/out.pcm" ] || { echo 'СТОП: live copy A/V test не прошёл'; exit 3; }

echo '[5/9] Проверяю безопасную alpha-mask R737/R739…'
ffmpeg -hide_banner -loglevel error \
  -f lavfi -i 'color=c=white:s=320x180:r=25:d=2' \
  -filter_complex "color=c=black@1.0:s=320x180:r=25,format=yuva420p,fade=t=in:st=0.4:d=0.3:alpha=1,fade=t=out:st=0.8:d=0.2:alpha=1[blackmask];[0:v][blackmask]overlay=x=0:y=0:shortest=1:format=yuv420[outv]" \
  -map '[outv]' -t 1.5 -f null - >/dev/null 2>&1 || { echo 'СТОП: alpha-mask test не прошёл'; exit 3; }

echo '[6/9] Backup текущего двигателя…'
cp -a "$SERVER" "$BACKUP"

rollback(){
  echo '⚠️ R742 не прошёл запуск — возвращаю предыдущий server.mjs…'
  cp -a "$BACKUP" "$SERVER"
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[7/9] Устанавливаю R742. MP3 1024/8 и ONE RTMPS не меняются…'
install -m 0644 "$TMP" "$SERVER"

echo '[8/9] Один restart радио…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 8
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[9/9] Проверяю status…'
STATUS=''; OK=0
for i in $(seq 1 25); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); ok=(d.get("version")=="R742-PREPARED-CLIP-COPY-YOUTUBE-HEALTH-R739-PRESERVED" and d.get("publisherRunning") and d.get("videoInputQueuePackets")==1024 and d.get("audioInputQueuePackets")==8 and d.get("clipPlaybackMode")=="R742-PREPARED-H264-COPY" and d.get("clipPreparationMode")=="R742-SERIAL-NICE12-ONE-THREAD" and d.get("clipLiveVideoCodec")=="copy" and d.get("videoTimelineCompensationMode")=="R739-RUNTIME-ADJUSTABLE" and d.get("stationInsertAudioRequired") is True and d.get("clipBoundaryReconnect") is False); raise SystemExit(0 if ok else 1)' 2>/dev/null; then
    OK=1
    break
  fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R742 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

printf '%s\n' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("VERSION:",d.get("version")); print("PUBLISHER:",d.get("publisherRunning")); print("PRODUCER:",d.get("producerRunning")); print("VIDEO QUEUE:",d.get("videoInputQueuePackets")); print("AUDIO QUEUE:",d.get("audioInputQueuePackets")); print("CLIP LIVE:",d.get("clipPlaybackMode")); print("CLIP PREP:",d.get("clipPreparationMode")); print("LIVE VIDEO CODEC:",d.get("clipLiveVideoCodec")); print("PREPARED READY:",d.get("preparedClipReady")); print("PREPARED PENDING:",d.get("preparedClipPending")); print("TIMELINE COMP:",d.get("videoTimelineCompensationSeconds")); print("LAST ERROR:",d.get("lastError"))'

echo
echo '========================================================'
echo '✅ R742 ГОТОВ'
echo '✅ MP3 транспорт сохранён: VIDEO 1024 / AUDIO 8'
echo '✅ ONE RTMPS publisher сохранён'
echo '✅ КЛИПЫ заранее готовятся: H264 1080p25 / B-frames 0 / AAC'
echo '✅ Подготовка: serial + nice 12 + 1 thread — не душит live publisher'
echo '✅ В ЭФИРЕ клип: c:v COPY, без тяжёлого live libx264'
echo '✅ Если клип ещё не готов — он откладывается, а не ломает YouTube health'
echo '✅ A/V lock + pre/post drain + звук station inserts сохранены'
echo '✅ R739 timeline compensation / NEXT / safe alpha fade сохранены'
echo '========================================================'

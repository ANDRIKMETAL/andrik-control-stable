#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
ENV_FILE=/etc/andrik-radio.env
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_SERVER="$(mktemp /tmp/andrik-r749.XXXXXX.mjs)"
BACKUP_SERVER="${SERVER}.bak-before-r749-$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP="${ENV_FILE}.bak-before-r749-$(date +%Y%m%d-%H%M%S)"
TESTDIR="$(mktemp -d /tmp/andrik-r749-test.XXXXXX)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
DROPIN="$DROPIN_DIR/r746-transport-selfheal.conf"
trap 'rm -f "$TMP_SERVER"; rm -rf "$TESTDIR"' EXIT

for c in curl node python3 systemctl ffmpeg ffprobe; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }

echo '[1/11] Скачиваю R749 server…'
STAMP="$(date +%s)"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r749-$STAMP" -o "$TMP_SERVER"

echo '[2/11] Проверяю R749 и сохранность R748/R747/R746…'
node --check "$TMP_SERVER" >/dev/null
grep -Fq "R749-INSERT-IRONCLAD-R748-PRESERVED" "$TMP_SERVER" || { echo 'СТОП: скачался не R749'; exit 3; }
grep -Fq "clipPrerollUsableR749" "$TMP_SERVER" || { echo 'СТОП: R749 preroll arm отсутствует'; exit 3; }
grep -Fq "R749-NO-H264-WRITER-FORCED-NORMAL" "$TMP_SERVER" || { echo 'СТОП: R749 H264 watchdog отсутствует'; exit 3; }
grep -Fq "INSERT_AUDIO_START_TIMEOUT_MS_R749" "$TMP_SERVER" || { echo 'СТОП: R749 audio-start guard отсутствует'; exit 3; }
grep -Fq "abortInsertHandoffR749" "$TMP_SERVER" || { echo 'СТОП: R749 safe insert fallback отсутствует'; exit 3; }
grep -Fq "START_PREVIEW_DELAY_SECONDS_R748 = 2.0" "$TMP_SERVER" || { echo 'СТОП: R748 intro preview потерян'; exit 3; }
grep -Fq "CTA_FADE_SECONDS_R748 = 0.35" "$TMP_SERVER" || { echo 'СТОП: R748 CTA fade потерян'; exit 3; }
grep -Fq "R747-TWO-PASS-MEASURED-LINEAR" "$TMP_SERVER" || { echo 'СТОП: R747 loudness потерян'; exit 3; }
grep -Fq "TRANSPORT_FATAL_RESTART_DELAY_MS_R746" "$TMP_SERVER" || { echo 'СТОП: R746 RTMPS self-heal потерян'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP_SERVER" || { echo 'СТОП: стабильная video queue изменилась'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP_SERVER" || { echo 'СТОП: стабильная audio queue изменилась'; exit 3; }

echo '[3/11] Smoke-test MP4: H264 без B-frames + реальный звук…'
ffmpeg -nostdin -hide_banner -loglevel error -y \
  -f lavfi -i 'testsrc2=s=640x360:r=25:d=2' \
  -f lavfi -i 'sine=frequency=740:sample_rate=44100:duration=2' \
  -map 0:v:0 -c:v libx264 -preset ultrafast -tune zerolatency -bf 0 -g 50 -keyint_min 50 -sc_threshold 0 -r 25 -pix_fmt yuv420p -threads 1 \
  -map 1:a:0 -c:a aac -b:a 128k -ar 44100 -ac 2 -t 2 "$TESTDIR/insert.mp4"
CODEC="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$TESTDIR/insert.mp4" | head -1)"
BFR="$(ffprobe -v error -select_streams v:0 -show_entries stream=has_b_frames -of default=nw=1:nk=1 "$TESTDIR/insert.mp4" | head -1)"
ACH="$(ffprobe -v error -select_streams a:0 -show_entries stream=channels -of default=nw=1:nk=1 "$TESTDIR/insert.mp4" | head -1)"
[ "$CODEC" = h264 ] || { echo "СТОП: codec=$CODEC"; exit 3; }
[ "$BFR" = 0 ] || { echo "СТОП: B-frames=$BFR"; exit 3; }
[ -n "$ACH" ] || { echo 'СТОП: test audio отсутствует'; exit 3; }
ffmpeg -nostdin -hide_banner -loglevel error -re -i "$TESTDIR/insert.mp4" -map 0:v:0 -an -c:v copy -bsf:v h264_mp4toannexb -t 0.35 -f h264 "$TESTDIR/video.h264"
ffmpeg -nostdin -hide_banner -loglevel error -re -i "$TESTDIR/insert.mp4" -map 0:a:0 -vn -af 'aresample=44100:async=1:first_pts=0,asetpts=PTS-STARTPTS' -c:a pcm_s16le -ar 44100 -ac 2 -t 0.35 -f s16le "$TESTDIR/audio.pcm"
[ -s "$TESTDIR/video.h264" ] || { echo 'СТОП: video preroll smoke-test failed'; exit 3; }
[ -s "$TESTDIR/audio.pcm" ] || { echo 'СТОП: audio boundary smoke-test failed'; exit 3; }

echo '[4/11] Backup server + env…'
cp -a "$SERVER" "$BACKUP_SERVER"
cp -a "$ENV_FILE" "$ENV_BACKUP"
rollback(){
  echo '⚠️ R749 не прошёл запуск — возвращаю предыдущую версию…'
  cp -a "$BACKUP_SERVER" "$SERVER"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[5/11] Устанавливаю R749 и безопасные пороги…'
install -m 0644 "$TMP_SERVER" "$SERVER"
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/andrik-radio.env')
s=p.read_text()
wanted={
 'VIDEO_PIPELINE_LEAD_SECONDS_R745':'10',
 'TRANSPORT_FATAL_RESTART_DELAY_MS_R746':'3500',
 'LOUDNESS_ANALYSIS_TIMEOUT_MS_R747':'12000',
 'INSERT_PREROLL_ARM_GRACE_MS_R749':'6000',
 'VIDEO_SOURCE_WATCHDOG_INTERVAL_MS_R749':'1000',
 'VIDEO_SOURCE_STUCK_MS_R749':'2500',
 'INSERT_AUDIO_START_TIMEOUT_MS_R749':'1500',
}
lines=s.splitlines(); out=[]; seen=set()
for line in lines:
    done=False
    for k,v in wanted.items():
        if line.startswith(k+'='):
            out.append(f'{k}={v}'); seen.add(k); done=True; break
    if not done: out.append(line)
for k,v in wanted.items():
    if k not in seen: out.append(f'{k}={v}')
p.write_text('\n'.join(out).rstrip()+'\n')
PY
chmod 600 "$ENV_FILE"

echo '[6/11] Проверяю systemd self-heal…'
mkdir -p "$DROPIN_DIR"
cat > "$DROPIN" <<'EOF2'
[Service]
Restart=on-failure
RestartSec=5s
EOF2
systemctl daemon-reload

echo '[7/11] Один контролируемый restart радио…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 10
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[8/11] Проверяю живой R749 status…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception:raise SystemExit(1)
ok=(
 d.get('version')=='R749-INSERT-IRONCLAD-R748-PRESERVED' and
 d.get('publisherRunning') is True and d.get('transportHealthy') is True and
 d.get('nextPreviewTiming')=='R748-INTRO-2S-5S-PLUS-FINAL-10S-FRAME-BOUND' and
 d.get('audioNormalizationMode')=='R747-TWO-PASS-MEASURED-EBU-R128-WITH-SINGLE-PASS-FALLBACK' and
 d.get('videoInputQueuePackets')==1024 and d.get('audioInputQueuePackets')==8 and
 d.get('clipAvSyncMode')=='R749-ARMED-PREROLL-AUDIO-BOUNDARY-WITH-SOURCE-WATCHDOG' and
 d.get('videoSourceWatchdogMode')=='R749-NO-H264-WRITER-FORCED-NORMAL' and
 int(d.get('videoSourceStuckMs') or 0)==2500 and
 int(d.get('insertPrerollArmGraceMs') or 0)==6000 and
 int(d.get('insertAudioStartTimeoutMs') or 0)==1500 and
 d.get('transportWatchdogMode')=='R746-FATAL-RTMPS-TLS-SIGNATURE-SYSTEMD-SELFHEAL'
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R749 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

echo '[9/11] Проверяю, что H264 источник реально жив…'
if ! STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
x=json.loads(os.environ['STATUS_JSON'])
# Сразу после restart нормальный visual feeder обязан быть жив. Bare clipActive больше
# никогда не считается здоровым состоянием.
raise SystemExit(0 if x.get('videoFeederRunning') is True or x.get('clipVideoPrerollRunning') is True else 1)
PY
then
  echo '❌ Нет живого H264 feeder после запуска.'
  rollback
  exit 6
fi

echo '[10/11] Сохраняю ночной restart 00:00 Bratislava…'
cat > /etc/systemd/system/andrik-radio-nightly-restart.service <<'EOF2'
[Unit]
Description=ANDRIK Radio Nightly Restart
[Service]
Type=oneshot
ExecStart=/usr/bin/systemctl restart andrik-radio.service
EOF2
cat > /etc/systemd/system/andrik-radio-nightly-restart.timer <<'EOF2'
[Unit]
Description=Restart ANDRIK Radio every night at 00:00 Bratislava
[Timer]
OnCalendar=*-*-* 00:00:00 Europe/Bratislava
AccuracySec=1s
Persistent=false
Unit=andrik-radio-nightly-restart.service
[Install]
WantedBy=timers.target
EOF2
systemctl daemon-reload
systemctl enable --now andrik-radio-nightly-restart.timer >/dev/null

echo '[11/11] Диагностика…'
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"));print("VIDEO FEEDER:",d.get("videoFeederRunning"));print("INSERT MODE:",d.get("clipAvSyncMode"));print("H264 WATCHDOG:",d.get("videoSourceWatchdogMode"),d.get("videoSourceStuckMs"),"ms");print("PREROLL ARM:",d.get("insertPrerollArmGraceMs"),"ms");print("AUDIO START GUARD:",d.get("insertAudioStartTimeoutMs"),"ms");print("RECOVERIES:",d.get("insertRecoveryCount"));print("LAST ERROR:",d.get("lastError"))'

echo
echo '========================================================'
echo '✅ R749 ГОТОВ — ВСТАВКИ УСИЛЕНЫ'
echo '✅ Чистый EOF video-preroll больше не ломает границу A/V'
echo '✅ clipActive без живого H264 больше НЕ считается здоровьем'
echo '✅ Нет H264 > 2.5с → normal visual восстанавливается автоматически'
echo '✅ Звук вставки обязан реально дать PCM максимум за 1.5с'
echo '✅ При любой ошибке вставки — safe fallback, без NODATA'
echo '✅ ONE RTMPS / VIDEO 1024 / AUDIO 8 сохранены'
echo '✅ R748 PREVIOUS/NEXT + CTA сохранены'
echo '✅ R747 loudness + R746 RTMPS self-heal сохранены'
echo '========================================================'

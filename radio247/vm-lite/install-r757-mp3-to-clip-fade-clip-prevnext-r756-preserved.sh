#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
ENV_FILE=/etc/andrik-radio.env
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_SERVER="$(mktemp /tmp/andrik-r757.XXXXXX.mjs)"
BACKUP_SERVER="${SERVER}.bak-before-r757-$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP="${ENV_FILE}.bak-before-r757-$(date +%Y%m%d-%H%M%S)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
DROPIN="$DROPIN_DIR/r757-mp3-to-clip-fade-prevnext.conf"
trap 'rm -f "$TMP_SERVER"' EXIT

for c in curl node python3 systemctl ffmpeg ffprobe nice; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }

echo '[1/10] Скачиваю R757 server…'
STAMP="$(date +%s)"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r757-$STAMP" -o "$TMP_SERVER"

echo '[2/10] Проверяю R757 и сохранность стабильного R756…'
node --check "$TMP_SERVER" >/dev/null
grep -Fq "R757-MP3-TO-CLIP-FADE-CLIP-PREVNEXT-R756-PRESERVED" "$TMP_SERVER" || { echo 'СТОП: скачался не R757'; exit 3; }
grep -Fq "R757-END-BLACK-HOLD-THEN-VIDEO-FADE-IN" "$TMP_SERVER" || { echo 'СТОП: MP3→clip fade отсутствует'; exit 3; }
grep -Fq "R757-NORMAL-CLIPS-PREVNEXT-INTRO-2-7S-PLUS-FINAL-10S" "$TMP_SERVER" || { echo 'СТОП: clip PREVIOUS/NEXT отсутствует'; exit 3; }
grep -Fq "endFadeToBlackR757=isVideoHandoffR738(actualNextR736)" "$TMP_SERVER" || { echo 'СТОП: boundary fade selector отсутствует'; exit 3; }
grep -Fq "showPreview:!stationInsert" "$TMP_SERVER" || { echo 'СТОП: clip intro preview wiring отсутствует'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 64" "$TMP_SERVER" || { echo 'СТОП: R756 64Q потерян'; exit 3; }
grep -Fq "setdar=16/9" "$TMP_SERVER" || { echo 'СТОП: R756/R755 full-frame lock потерян'; exit 3; }
grep -Fq "R754-GRACEFUL-SIGINT-FLUSH+AUD" "$TMP_SERVER" || { echo 'СТОП: R754 feeder stability потеряна'; exit 3; }
grep -Fq "R754-FFMPEG-FIFO-FIRST-NO-EARLY-SYSTEMD-EXIT" "$TMP_SERVER" || { echo 'СТОП: R754 RTMPS recovery потеряна'; exit 3; }
grep -Fq "VIDEO_FADE_LEAD_SECONDS_R735 = 0.40" "$TMP_SERVER" || { echo 'СТОП: идеальное MP3→MP3 затемнение потеряно'; exit 3; }
grep -Fq "NEXT • ANDRIK METAL RADIO 24/7" "$TMP_SERVER" || { echo 'СТОП: station label потерян'; exit 3; }

echo '[3/10] Проверяю FFmpeg drawtext/fade…'
PREV="$(mktemp /tmp/r757-prev.XXXXXX.txt)"; NEXT="$(mktemp /tmp/r757-next.XXXXXX.txt)"
printf 'PREVIOUS • ANDRIK — TEST\n' > "$PREV"
printf 'NEXT • ANDRIK — TEST\n' > "$NEXT"
ffmpeg -nostdin -hide_banner -loglevel error -f lavfi -i 'testsrc2=size=640x360:rate=25:duration=0.2' \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,setsar=1,setdar=16/9,fps=25,fade=t=in:st=0:d=0.55,drawtext=textfile='$PREV':fontsize=32:enable='between(t,2,7)',drawtext=textfile='$NEXT':fontsize=32:enable='between(t,2,7)'" \
  -f null - >/dev/null 2>&1
rm -f "$PREV" "$NEXT"

echo '[4/10] Backup server + env…'
cp -a "$SERVER" "$BACKUP_SERVER"
cp -a "$ENV_FILE" "$ENV_BACKUP"
rollback(){
  echo '⚠️ R757 не прошёл запуск — возвращаю предыдущую версию…'
  cp -a "$BACKUP_SERVER" "$SERVER"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[5/10] Устанавливаю R757 без изменения MP3→MP3 таймингов…'
install -m 0644 "$TMP_SERVER" "$SERVER"
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/andrik-radio.env')
s=p.read_text()
wanted={
 'VIDEO_PIPELINE_LEAD_SECONDS_R745':'10',
 'LOUDNESS_ANALYSIS_TIMEOUT_MS_R747':'45000',
 'LOUDNESS_BACKGROUND_NICE_R750':'15',
 'OUTPUT_FIFO_QUEUE_PACKETS_R750':'2048',
 'MASTER_BACKPRESSURE_STUCK_MS_R750':'30000',
 'MASTER_BACKPRESSURE_WATCHDOG_INTERVAL_MS_R750':'1000',
 'INSERT_PREROLL_ARM_GRACE_MS_R749':'6000',
 'VIDEO_SOURCE_WATCHDOG_INTERVAL_MS_R749':'1000',
 'VIDEO_SOURCE_STUCK_MS_R749':'2500',
 'INSERT_AUDIO_START_TIMEOUT_MS_R749':'4000',
 'INSERT_CACHE_WARM_LEAD_SECONDS_R752':'5',
 'CLIP_TO_TRACK_HANDOFF_GUARD_MS_R753':'5000',
 'CLIP_TO_TRACK_FADE_IN_SECONDS_R753':'0.55',
 'VIDEO_INSERT_FADE_IN_SECONDS_R757':'0.55',
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

echo '[6/10] Systemd safety…'
mkdir -p "$DROPIN_DIR"
cat > "$DROPIN" <<'EOF2'
[Service]
Restart=on-failure
RestartSec=5s
EOF2
systemctl daemon-reload

echo '[7/10] Один чистый restart…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 12
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[8/10] Проверяю R757 status…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception:raise SystemExit(1)
ok=(
 d.get('version')=='R757-MP3-TO-CLIP-FADE-CLIP-PREVNEXT-R756-PRESERVED' and
 d.get('publisherRunning') is True and
 d.get('mp3ToVideoFadeMode')=='R757-END-BLACK-HOLD-THEN-VIDEO-FADE-IN' and
 d.get('clipPreviewMode')=='R757-NORMAL-CLIPS-PREVNEXT-INTRO-2-7S-PLUS-FINAL-10S' and
 d.get('masterVideoMode')=='R756-HARD-1920x1080-DAR16x9-64Q-NO-STALE-40S-R755-PRESERVED' and
 abs(float(d.get('videoFadeLeadSeconds') or 0)-0.40)<0.01
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R757 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

echo '[9/10] Проверяю отсутствие немедленного transport crash…'
sleep 8
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
if journalctl -u "$SERVICE" --since '-20 sec' --no-pager | grep -Eq 'Main process exited.*status=(75|76)|R751 STREAM STALL'; then
  echo '❌ После R757 обнаружен transport restart.'
  rollback
  exit 6
fi

echo '[10/10] Диагностика…'
STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status || true)"
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"),"healthy=",d.get("transportHealthy"));print("VIDEO:",d.get("videoFeederRunning"));print("FADE:",d.get("mp3ToVideoFadeMode"));print("CLIP PREVIEW:",d.get("clipPreviewMode"));print("MASTER:",d.get("masterVideoMode"));print("ERROR:",d.get("lastError"));print("WARNING:",d.get("lastWarning"))'

echo
echo '✅ R757 ГОТОВ — MP3→CLIP FADE + CLIP PREVIOUS/NEXT'
echo '✅ MP3→MP3 затемнение и тайминги R756 не изменены'
echo '✅ перед обычным клипом MP3 уходит в чёрный и клип мягко появляется из чёрного'
echo '✅ обычный клип показывает PREVIOUS/NEXT на 2–7 сек и в финальные 10 сек'
echo '✅ R756 frame lock 64Q + R754 persistent master/RTMPS stability сохранены'
echo '========================================================'

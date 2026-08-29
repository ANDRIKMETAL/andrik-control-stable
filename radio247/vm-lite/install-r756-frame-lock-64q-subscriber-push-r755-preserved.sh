#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
ENV_FILE=/etc/andrik-radio.env
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_SERVER="$(mktemp /tmp/andrik-r756.XXXXXX.mjs)"
BACKUP_SERVER="${SERVER}.bak-before-r756-$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP="${ENV_FILE}.bak-before-r756-$(date +%Y%m%d-%H%M%S)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
DROPIN="$DROPIN_DIR/r756-frame-lock-subscriber.conf"
trap 'rm -f "$TMP_SERVER"' EXIT

for c in curl node python3 systemctl ffmpeg ffprobe nice; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }

echo '[1/10] Скачиваю R756 server…'
STAMP="$(date +%s)"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r756-$STAMP" -o "$TMP_SERVER"

echo '[2/10] Проверяю R756 + сохранность R755/R754/R753…'
node --check "$TMP_SERVER" >/dev/null
grep -Fq "R756-FRAME-LOCK-64Q-FULL-FIT-R755-PRESERVED" "$TMP_SERVER" || { echo 'СТОП: скачался не R756'; exit 3; }
grep -Fq "R756-HARD-1920x1080-DAR16x9-64Q-NO-STALE-40S-R755-PRESERVED" "$TMP_SERVER" || { echo 'СТОП: R756 frame lock отсутствует'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 64" "$TMP_SERVER" || { echo 'СТОП: R756 64-packet video queue отсутствует'; exit 3; }
grep -Fq "setdar=16/9" "$TMP_SERVER" || { echo 'СТОП: R756 DAR 16:9 lock отсутствует'; exit 3; }
grep -Fq "R754-GRACEFUL-SIGINT-FLUSH+AUD" "$TMP_SERVER" || { echo 'СТОП: clean feeder handoff отсутствует'; exit 3; }
grep -Fq "R754-FFMPEG-FIFO-FIRST-NO-EARLY-SYSTEMD-EXIT" "$TMP_SERVER" || { echo 'СТОП: fifo-first RTMPS recovery отсутствует'; exit 3; }
grep -Fq "aud=1:keyint=" "$TMP_SERVER" || { echo 'СТОП: H264 AUD boundary marker отсутствует'; exit 3; }
grep -Fq "scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1" "$TMP_SERVER" || { echo 'СТОП: R755 FULL-FRAME FIT / NO-CROP отсутствует'; exit 3; }
grep -Fq "NEXT • ANDRIK METAL RADIO 24/7" "$TMP_SERVER" || { echo 'СТОП: station label потерян'; exit 3; }
grep -Fq "VIDEO_FADE_LEAD_SECONDS_R735 = 0.40" "$TMP_SERVER" || { echo 'СТОП: идеальное затемнение R753 потеряно'; exit 3; }
grep -Fq "R753-CLIP-END-WAITING-FOR-SINGLE-MP3-FEEDER" "$TMP_SERVER" || { echo 'СТОП: R753 clip→MP3 handoff потерян'; exit 3; }
grep -Fq "R752-BOUNDARY-LOCKED-UNIFIED-AV-LIVE" "$TMP_SERVER" || { echo 'СТОП: R752 unified clip A/V потерян'; exit 3; }
grep -Fq "R750-SINGLE-PASS-INSTANT-FALLBACK" "$TMP_SERVER" || { echo 'СТОП: nonblocking loudness потерян'; exit 3; }

echo '[3/10] Проверяю локальный x264 encoder…'
ffmpeg -nostdin -hide_banner -loglevel error -f lavfi -i 'testsrc2=size=320x180:rate=25:duration=0.5' \
  -c:v libx264 -preset ultrafast -tune zerolatency -f null - >/dev/null 2>&1

echo '[4/10] Backup server + env…'
cp -a "$SERVER" "$BACKUP_SERVER"
cp -a "$ENV_FILE" "$ENV_BACKUP"
rollback(){
  echo '⚠️ R756 не прошёл запуск — возвращаю предыдущую версию…'
  cp -a "$BACKUP_SERVER" "$SERVER"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[5/10] Устанавливаю R756 FRAME LOCK без изменения идеальных таймингов…'
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

echo '[8/10] Проверяю R756 status…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception:raise SystemExit(1)
ok=(
 d.get('version')=='R756-FRAME-LOCK-64Q-FULL-FIT-R755-PRESERVED' and
 d.get('publisherRunning') is True and
 d.get('masterVideoMode')=='R756-HARD-1920x1080-DAR16x9-64Q-NO-STALE-40S-R755-PRESERVED' and
 d.get('feederBoundaryMode')=='R754-GRACEFUL-SIGINT-FLUSH+AUD' and
 d.get('transportRecoveryMode')=='R754-FFMPEG-FIFO-FIRST-NO-EARLY-SYSTEMD-EXIT' and
 abs(float(d.get('videoFadeLeadSeconds') or 0)-0.40)<0.01 and
 d.get('stationNextLabel')=='NEXT • ANDRIK METAL RADIO 24/7'
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R756 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

echo '[9/10] Проверяю живые процессы и отсутствие немедленного RTMPS fatal…'
sleep 8
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
if journalctl -u "$SERVICE" --since '-20 sec' --no-pager | grep -Eq 'Main process exited.*status=(75|76)|R751 STREAM STALL'; then
  echo '❌ Сразу после R756 обнаружен transport restart.'
  rollback
  exit 6
fi

echo '[10/10] Диагностика…'
STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status || true)"
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"),"healthy=",d.get("transportHealthy"));print("VIDEO:",d.get("videoFeederRunning"));print("AUDIO:",d.get("producerRunning"));print("MASTER VIDEO:",d.get("masterVideoMode"));print("BOUNDARY:",d.get("feederBoundaryMode"));print("RTMPS:",d.get("transportRecoveryMode"));print("FADE LEAD:",d.get("videoFadeLeadSeconds"));print("ERROR:",d.get("lastError"));print("WARNING:",d.get("lastWarning"))'

echo
echo '✅ R756 ГОТОВ — FRAME LOCK 64Q + R755/R754 STABILITY'
echo '✅ video queue 1024 → 64: старые кадры не могут прятаться ~40 секунд'
echo '✅ весь кадр жёстко FIT 1920x1080, SAR=1, DAR=16:9, crop/cover OFF'
echo '✅ prepared clips/inserts нормализуются в ту же геометрию перед master'
echo '✅ затемнение/названия/PREVIOUS-NEXT R753 НЕ ИЗМЕНЕНЫ'
echo '✅ R754 persistent master + FIFO-first RTMPS recovery сохранены'
echo 'ℹ️ Push R756 находится в _worker.js и вступает в силу после Cloudflare Pages deploy архива.'
echo '========================================================'

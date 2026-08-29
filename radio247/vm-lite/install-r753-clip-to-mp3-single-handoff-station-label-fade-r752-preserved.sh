#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
ENV_FILE=/etc/andrik-radio.env
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_SERVER="$(mktemp /tmp/andrik-r753.XXXXXX.mjs)"
BACKUP_SERVER="${SERVER}.bak-before-r753-$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP="${ENV_FILE}.bak-before-r753-$(date +%Y%m%d-%H%M%S)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
DROPIN="$DROPIN_DIR/r753-clip-to-mp3-single-handoff.conf"
trap 'rm -f "$TMP_SERVER"' EXIT

for c in curl node python3 systemctl ffmpeg ffprobe nice; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }

echo '[1/10] Скачиваю R753 server…'
STAMP="$(date +%s)"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r753-$STAMP" -o "$TMP_SERVER"

echo '[2/10] Проверяю R753 и сохранность R752/R751/R750/R749/R748/R746…'
node --check "$TMP_SERVER" >/dev/null
grep -Fq "R753-CLIP-TO-MP3-SINGLE-HANDOFF-STATION-LABEL-FADE-R752-PRESERVED" "$TMP_SERVER" || { echo 'СТОП: скачался не R753'; exit 3; }
grep -Fq "R752-CACHE-WARM-SCHEDULED-NO-LIVE-PREROLL" "$TMP_SERVER" || { echo 'СТОП: cache-only warm marker отсутствует'; exit 3; }
grep -Fq "R752-BOUNDARY-LOCKED-UNIFIED-AV-LIVE" "$TMP_SERVER" || { echo 'СТОП: boundary-locked A/V отсутствует'; exit 3; }
grep -Fq "detachNormalVideoAtBoundaryR752" "$TMP_SERVER" || { echo 'СТОП: точное переключение видео отсутствует'; exit 3; }
grep -Fq "child.__r752Live=false" "$TMP_SERVER" || { echo 'СТОП: clip child boundary gate отсутствует'; exit 3; }
grep -Fq "R753-CLIP-END-WAITING-FOR-SINGLE-MP3-FEEDER" "$TMP_SERVER" || { echo 'СТОП: R753 single clip→MP3 handoff отсутствует'; exit 3; }
grep -Fq "NEXT • ANDRIK METAL RADIO 24/7" "$TMP_SERVER" || { echo 'СТОП: короткая подпись радио отсутствует'; exit 3; }
grep -Fq "CLIP_TO_TRACK_FADE_IN_SECONDS_R753" "$TMP_SERVER" || { echo 'СТОП: fade-in после клипа отсутствует'; exit 3; }
grep -Fq "VIDEO_FADE_LEAD_SECONDS_R735 = 0.40" "$TMP_SERVER" || { echo 'СТОП: позднее затемнение R751 потеряно'; exit 3; }
grep -Fq "R751 master pipe NO-PROGRESS" "$TMP_SERVER" || { echo 'СТОП: R751 progress-aware watchdog потерян'; exit 3; }
grep -Fq "R750-SINGLE-PASS-INSTANT-FALLBACK" "$TMP_SERVER" || { echo 'СТОП: R750 nonblocking loudness потерян'; exit 3; }
grep -Fq "START_PREVIEW_DELAY_SECONDS_R748 = 2.0" "$TMP_SERVER" || { echo 'СТОП: R748 intro preview потерян'; exit 3; }
grep -Fq "TRANSPORT_FATAL_RESTART_DELAY_MS_R746" "$TMP_SERVER" || { echo 'СТОП: R746 RTMPS self-heal потерян'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP_SERVER" || { echo 'СТОП: video input queue изменилась'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP_SERVER" || { echo 'СТОП: audio input queue изменилась'; exit 3; }

echo '[3/10] Проверяю FFmpeg loudnorm…'
ffmpeg -nostdin -hide_banner -loglevel error -f lavfi -i 'sine=frequency=440:sample_rate=44100:duration=0.4' \
  -af 'loudnorm=I=-14:LRA=11:TP=-1.5:print_format=json' -f null - >/dev/null 2>&1

echo '[4/10] Backup server + env…'
cp -a "$SERVER" "$BACKUP_SERVER"
cp -a "$ENV_FILE" "$ENV_BACKUP"
rollback(){
  echo '⚠️ R753 не прошёл запуск — возвращаю предыдущую версию…'
  cp -a "$BACKUP_SERVER" "$SERVER"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[5/10] Устанавливаю R753 и безопасные пороги…'
install -m 0644 "$TMP_SERVER" "$SERVER"
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/andrik-radio.env')
s=p.read_text()
wanted={
 'VIDEO_PIPELINE_LEAD_SECONDS_R745':'10',
 'TRANSPORT_FATAL_RESTART_DELAY_MS_R746':'3500',
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
sleep 10
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[8/10] Проверяю живой R753 status…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception:raise SystemExit(1)
ok=(
 d.get('version')=='R753-CLIP-TO-MP3-SINGLE-HANDOFF-STATION-LABEL-FADE-R752-PRESERVED' and
 d.get('publisherRunning') is True and d.get('transportHealthy') is True and
 d.get('loudnessAnalysisBlockingLive') is False and
 int(d.get('outputFifoQueuePackets') or 0)==2048 and
 int(d.get('masterBackpressureWatchdogMs') or 0)==30000 and
 d.get('masterBackpressureDetection')=='R751-BLOCKED-PLUS-ZERO-BYTE-PROGRESS' and
 d.get('videoInputQueuePackets')==1024 and d.get('audioInputQueuePackets')==8 and
 d.get('clipAvSyncMode')=='R753-R752-CACHE-WARM+BOTH-OUTPUTS-READY+ATOMIC-BOUNDARY' and
 d.get('insertUnhandledRejectionGuard')=='R753-R752-UNIFIED-AV-EXIT-CATCH+R751-GUARD' and
 abs(float(d.get('videoFadeLeadSeconds') or 0)-0.40)<0.01 and
 float(d.get('videoPipelineLeadSeconds') or 0)==0 and
 abs(float(d.get('clipCacheWarmLeadSeconds') or 0)-5.0)<0.01 and
 int(d.get('insertAudioStartTimeoutMs') or 0)==4000 and
 int(d.get('clipToTrackHandoffGuardMs') or 0)==5000 and
 abs(float(d.get('clipToTrackFadeInSeconds') or 0)-0.55)<0.01 and
 d.get('stationNextLabel')=='NEXT • ANDRIK METAL RADIO 24/7'
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R753 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

echo '[9/10] Проверяю живые A/V источники…'
if ! STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
x=json.loads(os.environ['STATUS_JSON'])
assert x.get('producerRunning') is True or x.get('current') is not None
assert x.get('videoFeederRunning') is True or x.get('clipUnifiedAvRunning') is True
PY
then
  echo '❌ A/V source после запуска не подтвердился.'
  rollback
  exit 6
fi

echo '[10/10] Диагностика…'
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"),"healthy=",d.get("transportHealthy"));print("VIDEO:",d.get("videoFeederRunning"));print("AUDIO:",d.get("producerRunning"));print("CLIP SYNC:",d.get("clipAvSyncMode"));print("CLIP->MP3:",d.get("clipToTrackHandoffPending"),"fade=",d.get("clipToTrackFadeInSeconds"));print("STATION LABEL:",d.get("stationNextLabel"));print("BACKPRESSURE:",d.get("masterBackpressureDetection"),d.get("masterBackpressureWatchdogMs"),"ms");print("ERROR:",d.get("lastError"));print("WARNING:",d.get("lastWarning"))'

echo
echo '✅ R753 ГОТОВ — CLIP→MP3 SINGLE HANDOFF'
echo '✅ после клипа следующий MP3 запускает normal video feeder РОВНО ОДИН РАЗ'
echo '✅ watchdog не вмешивается в штатное clip→MP3 окно до 5 секунд'
echo '✅ MP3 после клипа проявляется из чёрного за 0.55с — переход виден'
echo '✅ SPECIAL 30/60/заставки показываются как NEXT • ANDRIK METAL RADIO 24/7'
echo '✅ R752 boundary-locked clip A/V сохранён'
echo '✅ R751/R750/R749/R748/R746 сохранены'
echo '========================================================'

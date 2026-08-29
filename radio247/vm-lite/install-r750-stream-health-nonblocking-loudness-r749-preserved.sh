#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
ENV_FILE=/etc/andrik-radio.env
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_SERVER="$(mktemp /tmp/andrik-r750.XXXXXX.mjs)"
BACKUP_SERVER="${SERVER}.bak-before-r750-$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP="${ENV_FILE}.bak-before-r750-$(date +%Y%m%d-%H%M%S)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
DROPIN="$DROPIN_DIR/r750-stream-health.conf"
trap 'rm -f "$TMP_SERVER"' EXIT

for c in curl node python3 systemctl ffmpeg ffprobe nice; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }

echo '[1/10] Скачиваю R750 server…'
STAMP="$(date +%s)"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r750-$STAMP" -o "$TMP_SERVER"

echo '[2/10] Проверяю R750 + сохранность R749/R748/R746…'
node --check "$TMP_SERVER" >/dev/null
grep -Fq "R750-STREAM-HEALTH-NONBLOCKING-LOUDNESS-R749-PRESERVED" "$TMP_SERVER" || { echo 'СТОП: скачался не R750'; exit 3; }
grep -Fq "R750-SINGLE-PASS-INSTANT-FALLBACK" "$TMP_SERVER" || { echo 'СТОП: nonblocking loudness отсутствует'; exit 3; }
grep -Fq "scheduleLoudnessAnalysisR750" "$TMP_SERVER" || { echo 'СТОП: background loudness queue отсутствует'; exit 3; }
grep -Fq "OUTPUT_FIFO_QUEUE_PACKETS_R750" "$TMP_SERVER" || { echo 'СТОП: bounded FIFO отсутствует'; exit 3; }
grep -Fq "'-drop_pkts_on_overflow','1'" "$TMP_SERVER" || { echo 'СТОП: FIFO anti-block отсутствует'; exit 3; }
grep -Fq "masterBackpressureWatchdogTickR750" "$TMP_SERVER" || { echo 'СТОП: stream-health watchdog отсутствует'; exit 3; }
grep -Fq "clipPrerollUsableR749" "$TMP_SERVER" || { echo 'СТОП: R749 insert guard потерян'; exit 3; }
grep -Fq "START_PREVIEW_DELAY_SECONDS_R748 = 2.0" "$TMP_SERVER" || { echo 'СТОП: R748 intro preview потерян'; exit 3; }
grep -Fq "TRANSPORT_FATAL_RESTART_DELAY_MS_R746" "$TMP_SERVER" || { echo 'СТОП: R746 RTMPS self-heal потерян'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP_SERVER" || { echo 'СТОП: video input queue изменилась'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP_SERVER" || { echo 'СТОП: audio input queue изменилась'; exit 3; }

echo '[3/10] Проверяю локальный FFmpeg loudnorm…'
ffmpeg -nostdin -hide_banner -loglevel error -f lavfi -i 'sine=frequency=440:sample_rate=44100:duration=0.4' \
  -af 'loudnorm=I=-14:LRA=11:TP=-1.5:print_format=json' -f null - >/dev/null 2>&1

echo '[4/10] Backup server + env…'
cp -a "$SERVER" "$BACKUP_SERVER"
cp -a "$ENV_FILE" "$ENV_BACKUP"
rollback(){
  echo '⚠️ R750 не прошёл запуск — возвращаю предыдущую версию…'
  cp -a "$BACKUP_SERVER" "$SERVER"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[5/10] Устанавливаю R750 и безопасные пороги…'
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
 'MASTER_BACKPRESSURE_STUCK_MS_R750':'10000',
 'MASTER_BACKPRESSURE_WATCHDOG_INTERVAL_MS_R750':'1000',
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

echo '[6/10] Systemd: гарантированный перезапуск при локальном/сетевом stall…'
mkdir -p "$DROPIN_DIR"
cat > "$DROPIN" <<'EOF2'
[Service]
Restart=on-failure
RestartSec=5s
EOF2
systemctl daemon-reload

echo '[7/10] Один чистый restart — сбрасываю старый BAD/NODATA буфер…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 10
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[8/10] Проверяю живой R750 status…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception:raise SystemExit(1)
ok=(
 d.get('version')=='R750-STREAM-HEALTH-NONBLOCKING-LOUDNESS-R749-PRESERVED' and
 d.get('publisherRunning') is True and d.get('transportHealthy') is True and
 d.get('loudnessAnalysisBlockingLive') is False and
 d.get('audioNormalizationMode')=='R750-NONBLOCKING-R747-TWO-PASS-CACHE-WITH-INSTANT-SINGLE-PASS-FALLBACK' and
 int(d.get('outputFifoQueuePackets') or 0)==2048 and
 d.get('outputDropPacketsOnOverflow') is True and
 int(d.get('masterBackpressureWatchdogMs') or 0)==10000 and
 d.get('videoInputQueuePackets')==1024 and d.get('audioInputQueuePackets')==8 and
 d.get('clipAvSyncMode')=='R749-ARMED-PREROLL-AUDIO-BOUNDARY-WITH-SOURCE-WATCHDOG'
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R750 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

echo '[9/10] Проверяю живые A/V источники…'
if ! STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
x=json.loads(os.environ['STATUS_JSON'])
assert x.get('producerRunning') is True or x.get('current') is not None
assert x.get('videoFeederRunning') is True or x.get('clipVideoPrerollRunning') is True
PY
then
  echo '❌ A/V source после запуска не подтвердился.'
  rollback
  exit 6
fi

echo '[10/10] Диагностика…'
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"),"healthy=",d.get("transportHealthy"));print("VIDEO:",d.get("videoFeederRunning"));print("AUDIO:",d.get("producerRunning"));print("LOUDNESS:",d.get("currentLoudnessMode"),"blocking=",d.get("loudnessAnalysisBlockingLive"));print("FIFO:",d.get("outputFifoQueuePackets"),"drop=",d.get("outputDropPacketsOnOverflow"));print("BACKPRESSURE WATCHDOG:",d.get("masterBackpressureWatchdogMs"),"ms");print("ERROR:",d.get("lastError"));print("WARNING:",d.get("lastWarning"))'

echo
echo '========================================================'
echo '✅ R750 ГОТОВ — STREAM HEALTH'
echo '✅ loudness-анализ больше НИКОГДА не задерживает начало MP3'
echo '✅ анализ громкости идёт по одному, nice=15, в фоне'
echo '✅ ffmpeg loudness timeout теперь warning, а не авария эфира'
echo '✅ FIFO ограничен 2048 пакетами и не блокирует энкодер при переполнении'
echo '✅ backpressure >10с → systemd полностью пересобирает RTMPS-сессию'
echo '✅ R749 железобетонные вставки сохранены'
echo '✅ R748 PREVIOUS/NEXT + CTA сохранены'
echo '========================================================'

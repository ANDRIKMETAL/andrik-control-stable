#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
ENV_FILE=/etc/andrik-radio.env
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-r746.XXXXXX.mjs)"
BACKUP="${SERVER}.bak-before-r746-$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP="${ENV_FILE}.bak-before-r746-$(date +%Y%m%d-%H%M%S)"
TESTDIR="$(mktemp -d /tmp/andrik-r746-test.XXXXXX)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
DROPIN="$DROPIN_DIR/r746-transport-selfheal.conf"
trap 'rm -f "$TMP"; rm -rf "$TESTDIR"' EXIT

for c in curl node python3 systemctl ffmpeg ffprobe; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }

echo '[1/10] Скачиваю R746…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r746-$(date +%s)" -o "$TMP"

echo '[2/10] Проверяю R746 + сохранённую R745/R744 базу…'
node --check "$TMP" >/dev/null
grep -Fq "R746-RTMPS-TLS-SELFHEAL-R745-PRESERVED" "$TMP" || { echo 'СТОП: скачался не R746'; exit 3; }
grep -Fq "TRANSPORT_FATAL_RESTART_DELAY_MS_R746" "$TMP" || { echo 'СТОП: transport watchdog отсутствует'; exit 3; }
grep -Fq "the specified session has been invalidated" "$TMP" || { echo 'СТОП: TLS invalidated detector отсутствует'; exit 3; }
grep -Fq "error in the pull function" "$TMP" || { echo 'СТОП: TLS pull detector отсутствует'; exit 3; }
grep -Fq "io error:\\s*end of file" "$TMP" || { echo 'СТОП: RTMPS EOF detector отсутствует'; exit 3; }
grep -Fq "process.exit(75)" "$TMP" || { echo 'СТОП: systemd self-heal exit отсутствует'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP" || { echo 'СТОП: video queue изменена'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP" || { echo 'СТОП: audio queue изменена'; exit 3; }
grep -Fq "TRACK_AUDIO_FADE_OUT_R726 = 1.25" "$TMP" || { echo 'СТОП: fade 1.25 потерян'; exit 3; }
grep -Fq "VIDEO_PIPELINE_LEAD_SECONDS_R745" "$TMP" || { echo 'СТОП: 10s video lead потерян'; exit 3; }
grep -Fq "previousOverlayTextR745" "$TMP" || { echo 'СТОП: TRUE PREVIOUS потерян'; exit 3; }
grep -Fq "ensureVideoSourceAfterClipR745" "$TMP" || { echo 'СТОП: clip-end recovery потерян'; exit 3; }
grep -Fq "clipBoundaryReconnect:false" "$TMP" || { echo 'СТОП: ONE RTMPS guard потерян'; exit 3; }

echo '[3/10] Smoke-test H264/no-B-frame + audio…'
ffmpeg -nostdin -hide_banner -loglevel error -y \
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

echo '[4/10] Backup server + env…'
cp -a "$SERVER" "$BACKUP"
cp -a "$ENV_FILE" "$ENV_BACKUP"
rollback(){
  echo '⚠️ R746 не прошёл запуск — возвращаю предыдущий server.mjs и env…'
  cp -a "$BACKUP" "$SERVER"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  rm -f "$DROPIN"
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[5/10] Устанавливаю R746 + фиксирую параметры…'
install -m 0644 "$TMP" "$SERVER"
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/andrik-radio.env')
s=p.read_text()
wanted={
 'VIDEO_PIPELINE_LEAD_SECONDS_R745':'10',
 'TRANSPORT_FATAL_RESTART_DELAY_MS_R746':'3500',
}
lines=s.splitlines(); out=[]; seen=set()
for line in lines:
    replaced=False
    for k,v in wanted.items():
        if line.startswith(k+'='):
            out.append(f'{k}={v}'); seen.add(k); replaced=True; break
    if not replaced: out.append(line)
for k,v in wanted.items():
    if k not in seen: out.append(f'{k}={v}')
p.write_text('\n'.join(out).rstrip()+'\n')
PY
chmod 600 "$ENV_FILE"

echo '[6/10] Включаю systemd self-heal для exit 75…'
mkdir -p "$DROPIN_DIR"
cat > "$DROPIN" <<'EOF2'
[Service]
Restart=on-failure
RestartSec=5s
EOF2
systemctl daemon-reload

echo '[7/10] Один restart радио…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 9
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[8/10] Проверяю R746 status…'
STATUS=''; OK=0
for i in $(seq 1 25); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json, os
try: d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception: raise SystemExit(1)
ok=(
 d.get('version')=='R746-RTMPS-TLS-SELFHEAL-R745-PRESERVED' and
 d.get('publisherRunning') is True and
 d.get('transportHealthy') is True and
 d.get('transportWatchdogMode')=='R746-FATAL-RTMPS-TLS-SIGNATURE-SYSTEMD-SELFHEAL' and
 int(d.get('transportSelfHealDelayMs') or 0)==3500 and
 d.get('videoInputQueuePackets')==1024 and
 d.get('audioInputQueuePackets')==8 and
 d.get('audioFadeOutSeconds')==1.25 and
 d.get('clipBoundaryReconnect') is False and
 d.get('clipEndGuardMode')=='R745-DURATION-WATCHDOG-PLUS-VIDEO-SOURCE-RECOVERY' and
 float(d.get('videoPipelineLeadSeconds') or 0)>=9.5
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R746 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi
RESTART_MODE="$(systemctl show "$SERVICE" -p Restart --value 2>/dev/null || true)"
[ "$RESTART_MODE" = "on-failure" ] || { echo "❌ systemd Restart=$RESTART_MODE"; rollback; exit 5; }

echo '[9/10] Сохраняю профилактический restart в 00:00 Bratislava…'
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

echo '[10/10] Итог…'
printf '%s\n' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("VERSION:",d.get("version")); print("PUBLISHER:",d.get("publisherRunning")); print("TRANSPORT HEALTHY:",d.get("transportHealthy")); print("WATCHDOG:",d.get("transportWatchdogMode")); print("SELF-HEAL DELAY:",d.get("transportSelfHealDelayMs")); print("VIDEO LEAD:",d.get("videoPipelineLeadSeconds")); print("CLIP EOF GUARD:",d.get("clipEndGuardMode")); print("LAST ERROR:",d.get("lastError"))'
echo "SYSTEMD RESTART: $RESTART_MODE"
systemctl list-timers andrik-radio-nightly-restart.timer --no-pager | tail -n +1

echo
echo '========================================================'
echo '✅ R746 ГОТОВ'
echo '✅ Найденный логом сбой 06:46:23 теперь ловится автоматически:'
echo '   Error in the pull function / IO error: End of file / TLS session invalidated'
echo '✅ Если FFmpeg PID жив, но RTMPS/TLS уже мёртв — Node выходит с code 75'
echo '✅ systemd автоматически поднимает чистый RTMPS-сеанс через 5 секунд'
echo '✅ R745 clip EOF guard / TRUE PREVIOUS / MIND IS A TRAP сохранены'
echo '✅ ONE RTMPS / VIDEO 1024 / AUDIO 8 / fade 1.25 / lead 10s сохранены'
echo '✅ Ночной restart остаётся: 00:00 Europe/Bratislava'
echo '========================================================'

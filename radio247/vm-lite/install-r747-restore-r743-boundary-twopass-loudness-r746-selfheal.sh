#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
ENV_FILE=/etc/andrik-radio.env
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-r747.XXXXXX.mjs)"
BACKUP="${SERVER}.bak-before-r747-$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP="${ENV_FILE}.bak-before-r747-$(date +%Y%m%d-%H%M%S)"
TESTDIR="$(mktemp -d /tmp/andrik-r747-test.XXXXXX)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
DROPIN="$DROPIN_DIR/r746-transport-selfheal.conf"
trap 'rm -f "$TMP"; rm -rf "$TESTDIR"' EXIT

for c in curl node python3 systemctl ffmpeg ffprobe; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }

echo '[1/11] Скачиваю R747…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r747-$(date +%s)" -o "$TMP"

echo '[2/11] Проверяю R747 и все сохранённые защиты…'
node --check "$TMP" >/dev/null
grep -Fq "R747-RESTORE-R743-BOUNDARY-TWOPASS-LOUDNESS-R746-SELFHEAL" "$TMP" || { echo 'СТОП: скачался не R747'; exit 3; }
grep -Fq "R747-R743-EXACT-FINAL-8S-AUDIBLE-BOUNDARY" "$TMP" || { echo 'СТОП: exact PREVIOUS/NEXT timing отсутствует'; exit 3; }
grep -Fq "R747-R743-EXACT-MP3-CLOCK-VIDEO-TO-MP3-PREROLL-TIME-EXTENDED" "$TMP" || { echo 'СТОП: MP3 boundary rebase отсутствует'; exit 3; }
grep -Fq "VIDEO_FADE_LEAD_SECONDS_R735 = 2.40" "$TMP" || { echo 'СТОП: R743 fade lead потерян'; exit 3; }
grep -Fq "VIDEO_FADE_SECONDS_R726 = 0.65" "$TMP" || { echo 'СТОП: 0.65 dark fade потерян'; exit 3; }
grep -Fq "VIDEO_FADE_IN_SECONDS_R736 = 0.30" "$TMP" || { echo 'СТОП: 0.30 brighten потерян'; exit 3; }
grep -Fq "TRACK_AUDIO_FADE_OUT_R726 = 1.25" "$TMP" || { echo 'СТОП: audio fade 1.25 потерян'; exit 3; }
grep -Fq "R747-TWO-PASS-MEASURED-LINEAR" "$TMP" || { echo 'СТОП: two-pass loudness отсутствует'; exit 3; }
grep -Fq "measured_I=" "$TMP" || { echo 'СТОП: measured loudnorm отсутствует'; exit 3; }
grep -Fq "TRANSPORT_FATAL_RESTART_DELAY_MS_R746" "$TMP" || { echo 'СТОП: R746 RTMPS self-heal потерян'; exit 3; }
grep -Fq "CLIP_END_GUARD_MARGIN_MS_R745" "$TMP" || { echo 'СТОП: R745 clip EOF guard потерян'; exit 3; }
grep -Fq "previousOverlayTextR745" "$TMP" || { echo 'СТОП: TRUE PREVIOUS потерян'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP" || { echo 'СТОП: video queue изменилась'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP" || { echo 'СТОП: audio queue изменилась'; exit 3; }

echo '[3/11] Smoke-test two-pass loudnorm…'
ffmpeg -nostdin -hide_banner -loglevel error -y -f lavfi -i 'sine=frequency=440:sample_rate=44100:duration=3' -filter:a 'volume=0.12' "$TESTDIR/in.wav"
ffmpeg -hide_banner -nostats -loglevel info -i "$TESTDIR/in.wav" -af 'loudnorm=I=-14:LRA=11:TP=-1.5:print_format=json' -f null - 2>"$TESTDIR/pass1.log"
python3 - "$TESTDIR/pass1.log" "$TESTDIR/loud.env" <<'PY'
import json,re,sys
text=open(sys.argv[1],encoding='utf-8',errors='ignore').read()
ms=list(re.finditer(r'\{[\s\S]*?"target_offset"[\s\S]*?\}',text))
assert ms, 'loudnorm JSON missing'
d=json.loads(ms[-1].group(0))
for k in ('input_i','input_lra','input_tp','input_thresh','target_offset'): float(d[k])
open(sys.argv[2],'w').write('\n'.join(f'{k}={d[k]}' for k in ('input_i','input_lra','input_tp','input_thresh','target_offset'))+'\n')
PY
. "$TESTDIR/loud.env"
ffmpeg -nostdin -hide_banner -loglevel error -y -i "$TESTDIR/in.wav" \
  -af "loudnorm=I=-14:LRA=11:TP=-1.5:measured_I=$input_i:measured_LRA=$input_lra:measured_TP=$input_tp:measured_thresh=$input_thresh:offset=$target_offset:linear=true,aresample=44100" \
  -c:a pcm_s16le "$TESTDIR/out.wav"
[ -s "$TESTDIR/out.wav" ] || { echo 'СТОП: two-pass test output пуст'; exit 3; }

echo '[4/11] Backup server + env…'
cp -a "$SERVER" "$BACKUP"
cp -a "$ENV_FILE" "$ENV_BACKUP"
rollback(){
  echo '⚠️ R747 не прошёл запуск — возвращаю предыдущий server.mjs и env…'
  cp -a "$BACKUP" "$SERVER"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[5/11] Устанавливаю R747 + фиксирую безопасные параметры…'
install -m 0644 "$TMP" "$SERVER"
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/andrik-radio.env')
s=p.read_text()
wanted={
 'VIDEO_PIPELINE_LEAD_SECONDS_R745':'10',
 'TRANSPORT_FATAL_RESTART_DELAY_MS_R746':'3500',
 'LOUDNESS_ANALYSIS_TIMEOUT_MS_R747':'12000',
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

echo '[6/11] Проверяю systemd self-heal R746…'
mkdir -p "$DROPIN_DIR"
cat > "$DROPIN" <<'EOF2'
[Service]
Restart=on-failure
RestartSec=5s
EOF2
systemctl daemon-reload

echo '[7/11] Один restart радио…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 10
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[8/11] Проверяю живой R747 status…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception:raise SystemExit(1)
ok=(
 d.get('version')=='R747-RESTORE-R743-BOUNDARY-TWOPASS-LOUDNESS-R746-SELFHEAL' and
 d.get('publisherRunning') is True and
 d.get('transportHealthy') is True and
 d.get('nextPreviewTiming')=='R747-R743-EXACT-FINAL-8S-AUDIBLE-BOUNDARY' and
 d.get('mp3BoundaryMode')=='R747-R743-EXACT-MP3-CLOCK-VIDEO-TO-MP3-PREROLL-TIME-EXTENDED' and
 d.get('audioNormalizationMode')=='R747-TWO-PASS-MEASURED-EBU-R128-WITH-SINGLE-PASS-FALLBACK' and
 d.get('videoInputQueuePackets')==1024 and d.get('audioInputQueuePackets')==8 and
 float(d.get('audioFadeOutSeconds') or 0)==1.25 and
 float(d.get('videoFadeSeconds') or 0)==0.65 and
 float(d.get('videoFadeInSeconds') or 0)==0.30 and
 d.get('clipBoundaryReconnect') is False and
 d.get('transportWatchdogMode')=='R746-FATAL-RTMPS-TLS-SIGNATURE-SYSTEMD-SELFHEAL'
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R747 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

echo '[9/11] Сохраняю профилактический restart 00:00 Bratislava…'
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

echo '[10/11] Короткая диагностика…'
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"));print("PREV/NEXT:",d.get("nextPreviewTiming"));print("MP3 BOUNDARY:",d.get("mp3BoundaryMode"));print("VIDEO FADE:",d.get("videoFadeSeconds"),"dark /",d.get("videoFadeInSeconds"),"light");print("LOUDNESS:",d.get("audioNormalizationMode"));print("CURRENT LOUDNESS:",d.get("currentLoudnessMode"));print("RTMPS SELF-HEAL:",d.get("transportWatchdogMode"));print("LAST ERROR:",d.get("lastError"))'

echo '[11/11] Готово.'
echo '========================================================'
echo '✅ R747 ГОТОВ'
echo '✅ MP3 → MP3: никакого 10s preroll; точный R743 frame-clock'
echo '✅ PREVIOUS/NEXT: реальные последние 8 секунд'
echo '✅ Затемнение/осветление: R743 0.65s → 0.05s black → 0.30s light'
echo '✅ TRUE PREVIOUS из R745 сохранён'
echo '✅ MP3: двухпроходный target -14 LUFS / TP -1.5 dBTP'
echo '✅ Клип/заставка: video-preroll сохранён; VIDEO→MP3 получает +lead к внутреннему timeline'
echo '✅ R746 RTMPS/TLS self-heal сохранён'
echo '✅ Ночной restart: 00:00 Europe/Bratislava'
echo '========================================================'

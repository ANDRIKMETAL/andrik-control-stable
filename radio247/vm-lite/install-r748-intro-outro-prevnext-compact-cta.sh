#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ASSET_DIR="$BASE/assets"
CTA="$ASSET_DIR/subscribe-like-r722.png"
SERVICE=andrik-radio.service
ENV_FILE=/etc/andrik-radio.env
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_SERVER="$(mktemp /tmp/andrik-r748.XXXXXX.mjs)"
TMP_CTA="$(mktemp /tmp/andrik-r748-cta.XXXXXX.png)"
BACKUP_SERVER="${SERVER}.bak-before-r748-$(date +%Y%m%d-%H%M%S)"
BACKUP_CTA="${CTA}.bak-before-r748-$(date +%Y%m%d-%H%M%S)"
TESTDIR="$(mktemp -d /tmp/andrik-r748-test.XXXXXX)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
DROPIN="$DROPIN_DIR/r746-transport-selfheal.conf"
trap 'rm -f "$TMP_SERVER" "$TMP_CTA"; rm -rf "$TESTDIR"' EXIT

for c in curl node python3 systemctl ffmpeg ffprobe; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }
mkdir -p "$ASSET_DIR"

echo '[1/12] Скачиваю R748 server + компактную CTA…'
STAMP="$(date +%s)"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r748-$STAMP" -o "$TMP_SERVER"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/subscribe-like-r722.png?v=55.00-r748-$STAMP" -o "$TMP_CTA"

echo '[2/12] Проверяю код и новую геометрию…'
node --check "$TMP_SERVER" >/dev/null
grep -Fq "R748-INTRO-OUTRO-PREVNEXT-COMPACT-CTA-R747-PRESERVED" "$TMP_SERVER" || { echo 'СТОП: скачался не R748'; exit 3; }
grep -Fq "START_PREVIEW_DELAY_SECONDS_R748 = 2.0" "$TMP_SERVER" || { echo 'СТОП: intro delay 2s отсутствует'; exit 3; }
grep -Fq "START_PREVIEW_SHOW_SECONDS_R748 = 5.0" "$TMP_SERVER" || { echo 'СТОП: intro preview 5s отсутствует'; exit 3; }
grep -Fq "NEXT_PREVIEW_SECONDS_R726 = 10" "$TMP_SERVER" || { echo 'СТОП: final preview 10s отсутствует'; exit 3; }
grep -Fq "CTA_FIRST_SHOW_SECONDS_R748 = 20" "$TMP_SERVER" || { echo 'СТОП: CTA schedule отсутствует'; exit 3; }
grep -Fq "CTA_FADE_SECONDS_R748 = 0.35" "$TMP_SERVER" || { echo 'СТОП: CTA smooth fade отсутствует'; exit 3; }
grep -Fq "CTA_BOTTOM_GAP_R748 = 100" "$TMP_SERVER" || { echo 'СТОП: CTA bottom-left position отсутствует'; exit 3; }
grep -Fq "R747-TWO-PASS-MEASURED-LINEAR" "$TMP_SERVER" || { echo 'СТОП: R747 loudness потерян'; exit 3; }
grep -Fq "TRANSPORT_FATAL_RESTART_DELAY_MS_R746" "$TMP_SERVER" || { echo 'СТОП: R746 self-heal потерян'; exit 3; }
grep -Fq "CLIP_END_GUARD_MARGIN_MS_R745" "$TMP_SERVER" || { echo 'СТОП: R745 clip guard потерян'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP_SERVER" || { echo 'СТОП: video queue изменилась'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP_SERVER" || { echo 'СТОП: audio queue изменилась'; exit 3; }
DIMS="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$TMP_CTA" | head -1)"
SIZE="$(stat -c%s "$TMP_CTA")"
[ "$DIMS" = '500x72' ] || { echo "СТОП: CTA должна быть 500x72, сейчас $DIMS"; exit 3; }
[ "$SIZE" -gt 2500 ] || { echo "СТОП: CTA подозрительно мала: $SIZE bytes"; exit 3; }

echo '[3/12] Smoke-test PREVIOUS/NEXT intro+outro + CTA alpha fade…'
printf 'PREVIOUS • ANDRIK — TEST A' > "$TESTDIR/prev.txt"
printf 'NEXT • ANDRIK — TEST B' > "$TESTDIR/next.txt"
ffmpeg -nostdin -hide_banner -loglevel error -y \
  -f lavfi -i 'color=c=0x20242a:s=1280x720:r=25:d=4' \
  -loop 1 -framerate 1 -i "$TMP_CTA" \
  -filter_complex "[0:v]drawtext=textfile='$TESTDIR/prev.txt':fontcolor=white:fontsize=24:x=20:y=500:box=1:boxcolor=black@0.6:enable='between(t\\,0.5\\,1.2)+between(t\\,2.5\\,3.7)'[b];[1:v]scale=500:-1:flags=lanczos,fps=25,setpts=PTS-STARTPTS,format=yuva420p[cta];[cta]fade=t=in:st=1.4:d=0.35:alpha=1,fade=t=out:st=2.4:d=0.35:alpha=1[ctaf];[b][ctaf]overlay=x=28:y=H-h-70:shortest=0:format=yuv420[outv]" \
  -map '[outv]' -t 4 -f null -

echo '[4/12] Backup server + CTA + env…'
cp -a "$SERVER" "$BACKUP_SERVER"
[ -s "$CTA" ] && cp -a "$CTA" "$BACKUP_CTA" || true
ENV_BACKUP="${ENV_FILE}.bak-before-r748-$(date +%Y%m%d-%H%M%S)"
cp -a "$ENV_FILE" "$ENV_BACKUP"
rollback(){
  echo '⚠️ R748 не прошёл запуск — возвращаю предыдущую версию…'
  cp -a "$BACKUP_SERVER" "$SERVER"
  [ -s "$BACKUP_CTA" ] && cp -a "$BACKUP_CTA" "$CTA" || true
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[5/12] Устанавливаю R748 server + компактную рамку…'
install -m 0644 "$TMP_SERVER" "$SERVER"
install -m 0644 "$TMP_CTA" "$CTA"
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

echo '[6/12] Проверяю R746 systemd self-heal…'
mkdir -p "$DROPIN_DIR"
cat > "$DROPIN" <<'EOF2'
[Service]
Restart=on-failure
RestartSec=5s
EOF2
systemctl daemon-reload

echo '[7/12] Один restart радио…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 10
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[8/12] Проверяю живой R748 status…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception:raise SystemExit(1)
ok=(
 d.get('version')=='R748-INTRO-OUTRO-PREVNEXT-COMPACT-CTA-R747-PRESERVED' and
 d.get('publisherRunning') is True and d.get('transportHealthy') is True and
 d.get('nextPreviewTiming')=='R748-INTRO-2S-5S-PLUS-FINAL-10S-FRAME-BOUND' and
 d.get('subscribeLikePosition')=='bottom-left-above-ticker' and
 d.get('subscribeLikeSize')=='500x72' and
 float(d.get('subscribeLikeFadeSeconds') or 0)==0.35 and
 float(d.get('startPreviewDelaySeconds') or 0)==2.0 and
 float(d.get('startPreviewShowSeconds') or 0)==5.0 and
 int(d.get('nextPreviewSeconds') or 0)==10 and
 d.get('audioNormalizationMode')=='R747-TWO-PASS-MEASURED-EBU-R128-WITH-SINGLE-PASS-FALLBACK' and
 d.get('videoInputQueuePackets')==1024 and d.get('audioInputQueuePackets')==8 and
 float(d.get('audioFadeOutSeconds') or 0)==1.25 and
 float(d.get('videoFadeSeconds') or 0)==0.65 and
 float(d.get('videoFadeInSeconds') or 0)==0.30 and
 d.get('transportWatchdogMode')=='R746-FATAL-RTMPS-TLS-SIGNATURE-SYSTEMD-SELFHEAL'
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R748 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

echo '[9/12] Сохраняю restart 00:00 Bratislava…'
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

echo '[10/12] Проверяю установленную CTA…'
INSTALLED_DIMS="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$CTA" | head -1)"
[ "$INSTALLED_DIMS" = '500x72' ] || { echo "СТОП: установленная CTA не 500x72: $INSTALLED_DIMS"; rollback; exit 6; }

echo '[11/12] Короткая диагностика…'
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PREV/NEXT:",d.get("nextPreviewTiming"));print("CTA:",d.get("subscribeLikeSize"),d.get("subscribeLikePosition"),"fade",d.get("subscribeLikeFadeSeconds"));print("LOUDNESS:",d.get("audioNormalizationMode"));print("RTMPS SELF-HEAL:",d.get("transportWatchdogMode"));print("LAST ERROR:",d.get("lastError"))'

echo '[12/12] Готово.'
echo '========================================================'
echo '✅ R748 ГОТОВ'
echo '✅ Начало трека: через 2с PREVIOUS + NEXT на 5с'
echo '✅ Конец трека: PREVIOUS + NEXT последние 10с'
echo '✅ SUBSCRIBE / LIKE: новая компактная рамка 500x72'
echo '✅ CTA: нижний левый угол, выше бегущей строки'
echo '✅ CTA: плавные 0.35с вход/выход, без частичного blink'
echo '✅ R747: two-pass -14 LUFS + fade/boundary сохранены'
echo '✅ R746 RTMPS/TLS self-heal сохранён'
echo '✅ Ночной restart: 00:00 Europe/Bratislava'
echo '========================================================'

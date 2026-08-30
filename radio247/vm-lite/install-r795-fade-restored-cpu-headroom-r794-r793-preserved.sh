#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ASSETS="$BASE/assets"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
STAMP="$(date +%s)"
TMP="$(mktemp -d /tmp/andrik-r795.XXXXXX)"
REMOTE="$TMP/server.mjs"
BACKUP="$SERVER.bak-before-r795-$(date +%Y%m%d-%H%M%S)"
trap 'rm -rf "$TMP"' EXIT

rollback(){
  echo '⚠️ R795 live-check не прошёл — возвращаю предыдущий server.'
  if [ -s "$BACKUP" ]; then cp -a "$BACKUP" "$SERVER"; fi
  systemctl restart "$SERVICE" || true
  sleep 8
  systemctl is-active "$SERVICE" || true
}

for c in curl node python3 ffmpeg ffprobe systemctl grep stat install cp ps awk; do
  command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }
done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
mkdir -p "$ASSETS"

echo '[1/6] Download R795 server + preserved R794 pre-scaled overlays'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r795-$STAMP" -o "$REMOTE"
for f in andrik-qr-r794-160.png subscribe-right-r794-420.png like-right-r794-420.png; do
  curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
    "$SITE_BASE/assets/$f?v=55.00-r795-$STAMP" -o "$TMP/$f"
done

echo '[2/6] Static audit: real R793 alpha-mask fade restored + R794 CPU wins preserved'
node --check "$REMOTE" >/dev/null
python3 - "$REMOTE" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text()
required=[
 "R795-FADE-RESTORED-CPU-HEADROOM-R794-R793-PRESERVED",
 "LIVE_FULL_FRAME_FILTER_R794",
 "flags=fast_bilinear",
 "color=c=black@1.0:s=1920x1080:r=${VIDEO_FPS},format=yuva420p,fade=t=in",
 "VIDEO_FADE_SECONDS_R726 = 0.65",
 "VIDEO_FADE_IN_SECONDS_R736 = 0.80",
 "VIDEO_BLACK_HOLD_SECONDS_R736 = 0.05",
 "fadeEngineR795:'R793-ALPHA-MASK-065-BLACK-HOLD-RECOVER'",
 "andrik-qr-r794-160.png",
 "subscribe-right-r794-420.png",
 "like-right-r794-420.png",
 "...h264EncoderArgsR721(),'-threads','2'",
 "BACKGROUND_LOUDNESS_ENABLED_R791 = false",
 "R792-STATION-ARM-BEHIND-LIVE-BLACK-NO-H264-GAP",
 "STREAM_BACKUP_URL",
]
missing=[x for x in required if x not in s]
if missing:
    print('СТОП: missing markers:', *missing, sep='\n - '); raise SystemExit(3)
if 'blackDrawboxStepR794' in s or 'blackFadeStepsR794' in s or 'blackoutFiltersR794' in s:
    raise SystemExit('СТОП: broken R794 drawbox-step fade still present')
if 'force_original_aspect_ratio=increase' in s or 'crop=' in s:
    raise SystemExit('СТОП: NO-CROP regression found')
print('R795 static audit OK')
PY

probe_dim(){ ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$1"; }
[ "$(probe_dim "$TMP/andrik-qr-r794-160.png")" = '160x160' ] || { echo 'СТОП: QR geometry'; exit 3; }
[ "$(probe_dim "$TMP/subscribe-right-r794-420.png" | cut -dx -f1)" = '420' ] || { echo 'СТОП: subscribe width'; exit 3; }
[ "$(probe_dim "$TMP/like-right-r794-420.png" | cut -dx -f1)" = '420' ] || { echo 'СТОП: like width'; exit 3; }

echo '[3/6] Backup + install'
cp -a "$SERVER" "$BACKUP"
install -m 0644 "$TMP/andrik-qr-r794-160.png" "$ASSETS/andrik-qr-r794-160.png"
install -m 0644 "$TMP/subscribe-right-r794-420.png" "$ASSETS/subscribe-right-r794-420.png"
install -m 0644 "$TMP/like-right-r794-420.png" "$ASSETS/like-right-r794-420.png"
install -m 0644 "$REMOTE" "$SERVER"

echo '[4/6] Restart radio'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 14
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[5/6] Status proof'
S1="$(curl -fsS --max-time 5 http://127.0.0.1:8080/status 2>/dev/null || true)"
if ! STATUS_JSON="$S1" python3 - <<'PY'
import os,json
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except:raise SystemExit(1)
ok=(
 d.get('version')=='R795-FADE-RESTORED-CPU-HEADROOM-R794-R793-PRESERVED' and
 d.get('publisherRunning') is True and
 d.get('fadeEngineR795')=='R793-ALPHA-MASK-065-BLACK-HOLD-RECOVER' and
 d.get('liveScalePolicyR794')=='FAST-BILINEAR-LIVE-MP3-ONLY-OFFLINE-LANCZOS-PRESERVED' and
 d.get('staticOverlayPolicyR794')=='PRE-SCALED-QR160-CTA420' and
 int(d.get('liveEncoderThreadsR794') or 0)==2 and
 d.get('backgroundLoudnessEnabled') is False
)
raise SystemExit(0 if ok else 1)
PY
then
  echo '❌ R795 status не подтвердился.'
  printf '%s\n' "$S1" | python3 -m json.tool 2>/dev/null || true
  rollback; exit 5
fi

echo '[6/6] Final + CPU snapshot'
printf '%s\n' "$S1" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("FADE:",d.get("fadeEngineR795"));print("PUBLISHER:",d.get("publisherRunning"));print("TRANSPORT:",d.get("transportHealthy"));print("ERROR:",d.get("lastError"));print("WARNING:",d.get("lastWarning"))'
ps -eo pid,ppid,%cpu,%mem,stat,etime,cmd --sort=-%cpu | grep '[f]fmpeg' | head -n 8 || true
uptime || true
echo "BACKUP: $BACKUP"
echo '✅ R795: старое проверенное затемнение R793 ВОССТАНОВЛЕНО: 0.65с темнее → 0.05с чёрный → 0.80с светлее'
echo '✅ R794 CPU headroom сохранён: fast live scaler + pre-scaled QR/CTA + threads=2'
echo '✅ 1080p25 / 6000k / NO-CROP / equalizer / CTA / title switch preserved'

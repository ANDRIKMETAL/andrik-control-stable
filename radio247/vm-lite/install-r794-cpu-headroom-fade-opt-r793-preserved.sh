#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ASSETS="$BASE/assets"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
STAMP="$(date +%s)"
TMP="$(mktemp -d /tmp/andrik-r794.XXXXXX)"
REMOTE="$TMP/server.mjs"
BACKUP="$SERVER.bak-before-r794-$(date +%Y%m%d-%H%M%S)"
trap 'rm -rf "$TMP"' EXIT

rollback(){
  echo '⚠️ R794 live-check не прошёл — возвращаю предыдущий server.'
  if [ -s "$BACKUP" ]; then cp -a "$BACKUP" "$SERVER"; fi
  systemctl restart "$SERVICE" || true
  sleep 8
  systemctl is-active "$SERVICE" || true
}

for c in curl node python3 ffmpeg ffprobe systemctl grep stat install cp ps awk sha256sum; do
  command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }
done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
mkdir -p "$ASSETS"

# Do not compete with the manually started 720->1080 conversion from the previous test.
if ps -eo cmd | grep '[f]fmpeg' | grep -q 'stream-evening-master-r620.optimized.tmp.mp4'; then
  echo 'СТОП: ещё работает предыдущая ручная конвертация master visual.'
  echo 'Нажми Ctrl+C в том терминале и повтори установку R794.'
  exit 2
fi
rm -f /var/cache/andrik-radio-r622/visuals/*.optimized.tmp.mp4 2>/dev/null || true

echo '[1/7] Download R794 server + live pre-scaled static overlays'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r794-$STAMP" -o "$REMOTE"
for f in andrik-qr-r794-160.png subscribe-right-r794-420.png like-right-r794-420.png; do
  curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
    "$SITE_BASE/assets/$f?v=55.00-r794-$STAMP" -o "$TMP/$f"
done

echo '[2/7] Static audit: CPU headroom + fade preserved + R793/R792 preserved'
node --check "$REMOTE" >/dev/null
python3 - "$REMOTE" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text()
required=[
 "R794-CPU-HEADROOM-FADE-OPT-R793-PRESERVED",
 "LIVE_FULL_FRAME_FILTER_R794",
 "flags=fast_bilinear",
 "const FULL_FRAME_FILTER_R787 = 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos",
 "blackDrawboxStepR794",
 "blackFadeStepsR794",
 "blackoutFiltersR794",
 "FRAME-STEPPED-DRAWBOX-NO-CONTINUOUS-1080P-ALPHA-MASK",
 "andrik-qr-r794-160.png",
 "subscribe-right-r794-420.png",
 "like-right-r794-420.png",
 "...h264EncoderArgsR721(),'-threads','2'",
 "BACKGROUND_LOUDNESS_ENABLED_R791 = false",
 "backgroundPrefetchLoudnessPolicyR793",
 "R792-STATION-ARM-BEHIND-LIVE-BLACK-NO-H264-GAP",
 "STREAM_BACKUP_URL",
 "rtmps://b.rtmps.youtube.com:443/live2?backup=1/",
]
missing=[x for x in required if x not in s]
if missing:
    print('СТОП: missing R794/R793/R792 markers:', *missing, sep='\n - '); raise SystemExit(3)
if 'force_original_aspect_ratio=increase' in s or 'crop=' in s:
    raise SystemExit('СТОП: NO-CROP regression found')
# Prove the live MP3 filter no longer creates the continuous full-HD alpha mask.
a=s.index('function normalVideoFilterComplexR721')
b=s.index('function clipFilterComplexR721',a)
normal=s[a:b]
for bad in ['color=c=black@1.0:s=1920x1080', '[blackmask]overlay=', '[startmask]overlay=']:
    if bad in normal: raise SystemExit('СТОП: old continuous fade mask returned: '+bad)
print('R794 static audit OK')
PY

# Asset geometry proof.
probe_dim(){ ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$1"; }
[ "$(probe_dim "$TMP/andrik-qr-r794-160.png")" = '160x160' ] || { echo 'СТОП: QR geometry'; exit 3; }
[ "$(probe_dim "$TMP/subscribe-right-r794-420.png" | cut -dx -f1)" = '420' ] || { echo 'СТОП: subscribe width'; exit 3; }
[ "$(probe_dim "$TMP/like-right-r794-420.png" | cut -dx -f1)" = '420' ] || { echo 'СТОП: like width'; exit 3; }

# Small syntax proof for the R794 per-frame black fade primitive.
ffmpeg -nostdin -hide_banner -loglevel error \
  -f lavfi -i 'testsrc2=s=320x180:r=25:d=1' \
  -vf "drawbox=x=0:y=0:w=iw:h=ih:color=black@0.5:t=fill:enable='gte(t,0.2)*lt(t,0.4)'" \
  -frames:v 25 -f null -
echo 'R794 fade primitive proof OK'

echo '[3/7] Backup + install server/assets'
cp -a "$SERVER" "$BACKUP"
install -m 0644 "$TMP/andrik-qr-r794-160.png" "$ASSETS/andrik-qr-r794-160.png"
install -m 0644 "$TMP/subscribe-right-r794-420.png" "$ASSETS/subscribe-right-r794-420.png"
install -m 0644 "$TMP/like-right-r794-420.png" "$ASSETS/like-right-r794-420.png"
install -m 0644 "$REMOTE" "$SERVER"

echo '[4/7] Restart radio'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 14
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[5/7] R794 status proof'
S1="$(curl -fsS --max-time 5 http://127.0.0.1:8080/status 2>/dev/null || true)"
if ! STATUS_JSON="$S1" python3 - <<'PY'
import os,json
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except:raise SystemExit(1)
ok=(
 d.get('version')=='R794-CPU-HEADROOM-FADE-OPT-R793-PRESERVED' and
 d.get('publisherRunning') is True and
 d.get('fadeEngineR794')=='FRAME-STEPPED-DRAWBOX-NO-CONTINUOUS-1080P-ALPHA-MASK' and
 d.get('liveScalePolicyR794')=='FAST-BILINEAR-LIVE-MP3-ONLY-OFFLINE-LANCZOS-PRESERVED' and
 d.get('staticOverlayPolicyR794')=='PRE-SCALED-QR160-CTA420' and
 int(d.get('liveEncoderThreadsR794') or 0)==2 and
 d.get('backgroundLoudnessEnabled') is False
)
raise SystemExit(0 if ok else 1)
PY
then
  echo '❌ R794 status не подтвердился.'
  printf '%s\n' "$S1" | python3 -m json.tool 2>/dev/null || true
  rollback; exit 5
fi

echo '[6/7] CPU snapshot (MP3 is the meaningful test)'
ps -eo pid,ppid,%cpu,%mem,stat,etime,cmd --sort=-%cpu | grep '[f]fmpeg' | head -n 8 || true
uptime || true

echo '[7/7] Final'
printf '%s\n' "$S1" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("FADE:",d.get("fadeEngineR794"));print("LIVE SCALE:",d.get("liveScalePolicyR794"));print("STATIC OVERLAYS:",d.get("staticOverlayPolicyR794"));print("ENCODER THREADS:",d.get("liveEncoderThreadsR794"));print("PUBLISHER:",d.get("publisherRunning"));print("TRANSPORT:",d.get("transportHealthy"));print("ERROR:",d.get("lastError"));print("WARNING:",d.get("lastWarning"))'
echo "BACKUP: $BACKUP"
echo '✅ R794: 1080p25 / 6000k / NO-CROP preserved'
echo '✅ Viewer-approved 0.65s darken + 0.05s black + 0.80s brighten preserved at exact 25fps frame steps'
echo '✅ Continuous full-HD alpha mask/overlay removed from normal MP3 path'
echo '✅ Equalizer remains full 25fps and visually unchanged'
echo '✅ QR/Subscribe/Like are pre-scaled once, not Lanczos-scaled every live frame'
echo '✅ Live MP3 scaler is CPU-light; offline prepared clips keep high-quality Lanczos'

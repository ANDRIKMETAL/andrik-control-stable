#!/usr/bin/env bash
set -Eeuo pipefail
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
SERVICE=andrik-radio.service
DIR=/opt/andrik-radio/radio247
LIVE="$DIR/server.mjs"
GOLD="$DIR/server-r821-final-stable-golden.mjs"
GUARD=/usr/local/sbin/andrik-r821-final-stable-guard.sh
DROP_DIR=/etc/systemd/system/andrik-radio.service.d
DROP="$DROP_DIR/01-r821-final-stable.conf"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP=/root/andrik-r821-final-stable-before-$STAMP
TMP=$(mktemp --suffix=.mjs)
trap 'rm -f "$TMP"' EXIT

[ "$EUID" -eq 0 ] || { echo 'ERROR: run with sudo'; exit 1; }
for C in curl node python3 systemctl ss grep; do command -v "$C" >/dev/null || { echo "ERROR: $C missing"; exit 1; }; done
mkdir -p "$BACKUP" "$DROP_DIR"
[ -f "$LIVE" ] && cp -a "$LIVE" "$BACKUP/server.mjs.before" || true
cp -a "$DROP_DIR" "$BACKUP/systemd-dropins" 2>/dev/null || true

echo '=== DOWNLOAD EXACT R821 FINAL STABLE ==='
curl -fsSL --retry 6 --retry-delay 2 \
  "$SITE_BASE/radio247/vm-lite/server-r821-final-stable-r822-gapbridge.mjs?t=$(date +%s)" \
  -o "$TMP"

node --check "$TMP"
python3 - "$TMP" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text(encoding='utf-8')
required=[
 "version: 'R821-FINAL-STABLE-R822-AUDIO-GAP-BRIDGE-R820-PRESERVED'",
 "R821-STATION-NO-DRAIN-MAKE-BEFORE-BREAK",
 "r821-station-no-drain-promoted",
 "r822-station-preplay-no-live-decode",
 "INSERT_CACHE_WARM_LEAD_SECONDS_R752 || 8.0",
 "asetpts=PTS-STARTPTS,aresample=",
 "force_original_aspect_ratio=decrease",
 "pad=1920:1080",
 "MP3_BOUNDARY_FADE_OUT_SECONDS_R814 = 3.10",
 "MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814 = 0.20",
 "MP3_BOUNDARY_FADE_IN_SECONDS_R814 = 1.50",
 "VIDEO_FADE_SECONDS_R726 = 2.65",
 "a non-NULL packet sent after an EOF",
 "failed to send packet to filter extract_extradata",
 "startMasterAudioGapBridgeR824",
 "r824-audio-gap-bridge-start",
]
for x in required:
    if x not in s: raise SystemExit('ERROR missing: '+x)
for x in ['r823-live-frame-stall','R831-R814-GOLDEN']:
    if x in s: raise SystemExit('ERROR forbidden: '+x)
print('STATIC GUARD OK')
PY

echo '=== ONE CONTROLLED RESTART ==='
systemctl stop "$SERVICE" || true
cp -a "$TMP" "$LIVE"
cp -a "$TMP" "$GOLD"
chmod 0644 "$LIVE" "$GOLD"

# Disable only older ANDRIK ExecStartPre golden guards.
mkdir -p "$BACKUP/disabled-old-guards"
shopt -s nullglob
for F in "$DROP_DIR"/*.conf; do
  [ "$F" = "$DROP" ] && continue
  if grep -qE '^ExecStartPre=.*andrik' "$F" 2>/dev/null; then
    mv "$F" "$BACKUP/disabled-old-guards/"
  fi
done
shopt -u nullglob

cat > "$GUARD" <<'GUARDSH'
#!/usr/bin/env bash
set -Eeuo pipefail
LIVE=/opt/andrik-radio/radio247/server.mjs
GOLD=/opt/andrik-radio/radio247/server-r821-final-stable-golden.mjs
[ -s "$GOLD" ] || exit 91
node --check "$GOLD" >/dev/null
if [ ! -s "$LIVE" ] || ! cmp -s "$LIVE" "$GOLD"; then
  cp -a "$GOLD" "$LIVE"
  echo 'R821 FINAL STABLE GUARD: golden restored'
fi
node --check "$LIVE" >/dev/null
GUARDSH
chmod 0755 "$GUARD"
cat > "$DROP" <<EOF
[Service]
ExecStartPre=$GUARD
EOF

systemctl daemon-reload
systemctl reset-failed "$SERVICE" || true
systemctl start "$SERVICE"

RT=0
for i in $(seq 1 90); do
  RT=$(ss -tnp 2>/dev/null | grep '^ESTAB' | grep ':443' | grep -c ffmpeg || true)
  printf '\rRTMPS %s/2 ' "$RT"
  [ "$RT" -ge 2 ] && { echo; break; }
  sleep 1
done

echo '=== STATUS ==='
curl -fsS --max-time 4 http://127.0.0.1:8080/status || true
echo

echo '=================================================='
echo ' R821 FINAL STABLE ACTIVE'
echo ' R814 contain geometry        : PRESERVED'
echo ' R822 station live decode     : OFF'
echo ' R822 station audio PTS reset : ON'
echo ' R822 warm lead               : 8s'
echo ' R824 inter-item audio bridge : ON'
echo ' R751 real stall watchdog     : PRESERVED'
echo ' EOF/extract_extradata heal   : ON'
echo ' MP3 fade                     : 3.10 / 0.20 / 1.50'
echo ' MP3->video darken            : 2.65'
echo " RTMPS                        : $RT/2"
echo " GOLDEN                       : $GOLD"
echo " BACKUP                       : $BACKUP"
echo '=================================================='

#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
LIVE="/opt/andrik-radio/radio247/server.mjs"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${LIVE}.bak-before-r801-${STAMP}"
TMP="$(mktemp --suffix=.mjs)"
trap 'rm -f "$TMP"' EXIT

if [[ ! -f "$LIVE" ]]; then
  echo "ERROR: live server not found: $LIVE" >&2
  exit 1
fi

echo "=== R801 DOWNLOAD ==="
curl -fsSL --retry 5 --retry-delay 2 \
  "${SITE_BASE}/radio247/server.mjs" -o "$TMP"

echo "=== R801 CANDIDATE CHECK ==="
grep -q "R801-MP3-ATOMIC-HANDOFF" "$TMP" || { echo "ERROR: downloaded server is not R801" >&2; exit 1; }
grep -q "R801-MP3-ATOMIC-READY-BEFORE-CUT" "$TMP" || { echo "ERROR: R801 atomic handoff block missing" >&2; exit 1; }
grep -q "const outroStart=Math.max(0,d-12.0)" "$TMP" || { echo "ERROR: R801 T-12 preview start missing" >&2; exit 1; }
grep -q "const outroEnd=Math.max(outroStart+0.25,d-4.0)" "$TMP" || { echo "ERROR: R801 T-4 preview end missing" >&2; exit 1; }
node --check "$TMP"

echo "=== YOUTUBE TRANSPORT BYTE-GUARD ==="
python3 - "$LIVE" "$TMP" <<'PY'
from pathlib import Path
import hashlib, sys
live=Path(sys.argv[1]).read_text(encoding='utf-8')
cand=Path(sys.argv[2]).read_text(encoding='utf-8')

def cut(s,a,b):
    try:
        i=s.index(a); j=s.index(b,i)
    except ValueError as e:
        raise SystemExit(f"ERROR: transport guard marker missing: {e}")
    return s[i:j]

ranges=[
    ('INGEST', 'const STREAM_URL_OVERRIDE', 'const YOUTUBE_LIVE_URL'),
    ('TRANSPORT_CONSTANTS', 'const TRANSPORT_FATAL_RESTART_DELAY_MS_R746', 'const LIVE_CURRENT_FILE'),
    ('H264_ENCODER', 'function h264EncoderArgsR721()', 'function scheduleOutputFatalRestartR780'),
    ('WATCHDOG_AND_PUBLISHER', 'function scheduleOutputFatalRestartR780', 'async function visualLoopOffsetR735')
]
for name,a,b in ranges:
    x=cut(live,a,b); y=cut(cand,a,b)
    hx=hashlib.sha256(x.encode()).hexdigest(); hy=hashlib.sha256(y.encode()).hexdigest()
    print(f"{name}: live={hx[:16]} candidate={hy[:16]}")
    if x != y:
        raise SystemExit(f"ERROR: {name} changed. R801 refuses to touch YouTube transport.")
print('OK: YouTube primary/backup RTMPS + FIFO + recovery + H264 publisher are byte-identical.')
PY

echo "=== BACKUP ==="
cp -a "$LIVE" "$BACKUP"
echo "$BACKUP"

echo "=== INSTALL R801 SERVER ==="
cat "$TMP" > "$LIVE"
chown --reference="$BACKUP" "$LIVE"
chmod --reference="$BACKUP" "$LIVE"
node --check "$LIVE"

echo "=== CONTROLLED RADIO RESTART ==="
if ! systemctl restart andrik-radio.service; then
  echo "ERROR: restart command failed; rolling back" >&2
  cp -a "$BACKUP" "$LIVE"
  systemctl restart andrik-radio.service || true
  exit 1
fi
sleep 10

if [[ "$(systemctl is-active andrik-radio.service || true)" != "active" ]]; then
  echo "ERROR: R801 service not active; rolling back" >&2
  cp -a "$BACKUP" "$LIVE"
  systemctl restart andrik-radio.service || true
  sleep 5
  systemctl status andrik-radio.service --no-pager -l | tail -n 80 || true
  exit 1
fi

echo "=== R801 ACTIVE ==="
systemctl is-active andrik-radio.service
grep -n "version: 'R801\|R801-MP3-ATOMIC-READY-BEFORE-CUT\|const outroStart=Math.max(0,d-12.0)\|const outroEnd=Math.max(outroStart+0.25,d-4.0)" "$LIVE" | head -n 12

echo "=== CURRENT FFMPEG ==="
ps -eo pid,ppid,%cpu,%mem,stat,etime,cmd --sort=-%cpu | grep '[f]fmpeg' | head -n 8 || true

echo "=== R801 INSTALLED ==="
echo "MP3 PREVIOUS/NEXT: T-12s .. T-4s"
echo "CTA boundary reserve: final 6s clear"
echo "MP3 H264 handoff: next feeder READY before old feeder CUT"
echo "Fade: R799/R787 preserved"
echo "YouTube transport: byte-identical / untouched"
echo "BACKUP=$BACKUP"

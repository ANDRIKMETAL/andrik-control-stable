#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
LIVE="/opt/andrik-radio/radio247/server.mjs"
AGENT_LIVE="/usr/local/lib/andrik-radio-web-agent-r721.mjs"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${LIVE}.bak-before-r802-${STAMP}"
AGENT_BACKUP="${AGENT_LIVE}.bak-before-r802-${STAMP}"
TMP_SERVER="$(mktemp --suffix=.mjs)"
TMP_AGENT="$(mktemp --suffix=.mjs)"
trap 'rm -f "$TMP_SERVER" "$TMP_AGENT"' EXIT

[[ -f "$LIVE" ]] || { echo "ERROR: live server not found: $LIVE" >&2; exit 1; }

echo "=== R802 DOWNLOAD ==="
curl -fsSL --retry 5 --retry-delay 2 "${SITE_BASE}/radio247/server.mjs" -o "$TMP_SERVER"
curl -fsSL --retry 5 --retry-delay 2 "${SITE_BASE}/radio247/vm-lite/andrik-radio-web-agent-r802.mjs" -o "$TMP_AGENT"

echo "=== R802 CANDIDATE CHECK ==="
grep -q "R802-STATION-CORRUPTION-SELFHEAL" "$TMP_SERVER" || { echo "ERROR: downloaded server is not R802" >&2; exit 1; }
grep -q "station-integrity-fail" "$TMP_SERVER" || { echo "ERROR: station integrity guard missing" >&2; exit 1; }
grep -q "diagnosticsR802" "$TMP_SERVER" || { echo "ERROR: R802 diagnostics missing" >&2; exit 1; }
grep -q "AGENT_VERSION_R802='R802'" "$TMP_AGENT" || { echo "ERROR: R802 web agent missing" >&2; exit 1; }
node --check "$TMP_SERVER"
node --check "$TMP_AGENT"

echo "=== YOUTUBE TRANSPORT BYTE-GUARD ==="
python3 - "$LIVE" "$TMP_SERVER" <<'PY'
from pathlib import Path
import hashlib,sys
live=Path(sys.argv[1]).read_text(encoding='utf-8')
cand=Path(sys.argv[2]).read_text(encoding='utf-8')
def cut(s,a,b):
    i=s.index(a); j=s.index(b,i); return s[i:j]
ranges=[
 ('INGEST','const STREAM_URL_OVERRIDE','const YOUTUBE_LIVE_URL'),
 ('TRANSPORT_CONSTANTS','const TRANSPORT_FATAL_RESTART_DELAY_MS_R746','const LIVE_CURRENT_FILE'),
 ('H264_ENCODER','function h264EncoderArgsR721()','function scheduleOutputFatalRestartR780'),
 ('WATCHDOG_AND_PUBLISHER','function scheduleOutputFatalRestartR780','async function visualLoopOffsetR735')]
for name,a,b in ranges:
    x=cut(live,a,b); y=cut(cand,a,b)
    print(f"{name}: live={hashlib.sha256(x.encode()).hexdigest()[:16]} candidate={hashlib.sha256(y.encode()).hexdigest()[:16]}")
    if x!=y: raise SystemExit(f"ERROR: {name} changed. R802 refuses to touch YouTube transport.")
print('OK: YouTube primary/backup RTMPS + FIFO + recovery + H264 publisher are byte-identical.')
PY

echo "=== BACKUP ==="
cp -a "$LIVE" "$BACKUP"
if [[ -f "$AGENT_LIVE" ]]; then cp -a "$AGENT_LIVE" "$AGENT_BACKUP"; fi
echo "$BACKUP"

echo "=== INSTALL R802 SERVER + DIAG AGENT ==="
cat "$TMP_SERVER" > "$LIVE"
chown --reference="$BACKUP" "$LIVE"
chmod --reference="$BACKUP" "$LIVE"
node --check "$LIVE"
install -m 0755 "$TMP_AGENT" "$AGENT_LIVE"
node --check "$AGENT_LIVE"

echo "=== PURGE ONLY STATION INSERT CACHE ==="
CACHE="/var/cache/andrik-radio-r622/clips"
if [[ -d "$CACHE" ]]; then
  find "$CACHE" -maxdepth 1 -type f \( -name 'radio-bumper-*' -o -name 'radio-special-*' \) -print -delete || true
fi

echo "=== CONTROLLED RADIO RESTART ==="
if ! systemctl restart andrik-radio.service; then
  echo "ERROR: radio restart failed; rolling back server" >&2
  cp -a "$BACKUP" "$LIVE"
  systemctl restart andrik-radio.service || true
  exit 1
fi
sleep 12
if [[ "$(systemctl is-active andrik-radio.service || true)" != "active" ]]; then
  echo "ERROR: R802 radio not active; rolling back" >&2
  cp -a "$BACKUP" "$LIVE"
  systemctl restart andrik-radio.service || true
  sleep 5
  systemctl status andrik-radio.service --no-pager -l | tail -n 100 || true
  exit 1
fi

# This agent restart does NOT touch FFmpeg/RTMPS. It only refreshes the 4-second
# status heartbeat so the sanitized R802 black-box log reaches Control/D1.
if systemctl list-unit-files --type=service | grep -q '^andrik-radio-web-agent.service'; then
  systemctl restart andrik-radio-web-agent.service || true
fi
sleep 3

echo "=== R802 ACTIVE ==="
systemctl is-active andrik-radio.service
grep -n "version: 'R802\|diagnosticsR802\|station-integrity-fail" "$LIVE" | head -n 12

echo "=== DIAGNOSTIC ENDPOINT AFTER SITE DEPLOY ==="
echo "https://andrikmetal.com/api/public/radio-diagnostics-r802"

echo "=== CURRENT FFMPEG ==="
ps -eo pid,ppid,%cpu,%mem,stat,etime,cmd --sort=-%cpu | grep '[f]fmpeg' | head -n 8 || true

echo "=== R802 INSTALLED ==="
echo "Station bumper cache: purged once and rebuilt from clean source"
echo "Station source + prepared MP4: full packet/NAL validation before LIVE"
echo "Corrupt station insert: rebuilt or safely skipped before handoff"
echo "Durable black-box log: /var/cache/andrik-radio-r622/diagnostics/r802-events.ndjson"
echo "R801 MP3 atomic handoff + fade: preserved"
echo "YouTube transport: byte-identical / untouched"
echo "BACKUP=$BACKUP"

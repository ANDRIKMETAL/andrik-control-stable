#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
LIVE="/opt/andrik-radio/radio247/server.mjs"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${LIVE}.bak-before-r804-${STAMP}"
TMP_SERVER="$(mktemp --suffix=.mjs)"
trap 'rm -f "$TMP_SERVER"' EXIT

[[ -f "$LIVE" ]] || { echo "ERROR: live server not found: $LIVE" >&2; exit 1; }

RADIO_PID_BEFORE="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
RADIO_ACTIVE_BEFORE="$(systemctl is-active andrik-radio.service 2>/dev/null || true)"

echo "=== R804 DOWNLOAD ==="
curl -fsSL --retry 5 --retry-delay 2 "${SITE_BASE}/radio247/server.mjs" -o "$TMP_SERVER"

echo "=== R804 CANDIDATE CHECK ==="
grep -q "R804-STATION-SINGLE-WRITER-CLEAN-AU-HANDOFF" "$TMP_SERVER" || { echo "ERROR: downloaded server is not R804" >&2; exit 1; }
grep -q "station-r804-clean-cut-complete" "$TMP_SERVER" || { echo "ERROR: R804 clean-cut diagnostics missing" >&2; exit 1; }
grep -q "detachNormalVideoForStationR804" "$TMP_SERVER" || { echo "ERROR: R804 station single-writer helper missing" >&2; exit 1; }
grep -q "__r804StationCut" "$TMP_SERVER" || { echo "ERROR: R804 visual-exit guard missing" >&2; exit 1; }
node --check "$TMP_SERVER"

echo "=== PRESERVATION GUARDS ==="
python3 - "$LIVE" "$TMP_SERVER" <<'PY'
from pathlib import Path
import hashlib,sys
live=Path(sys.argv[1]).read_text(encoding='utf-8')
cand=Path(sys.argv[2]).read_text(encoding='utf-8')

def cut(s,a,b):
    i=s.index(a); j=s.index(b,i); return s[i:j]

def same(name,a,b):
    x=cut(live,a,b); y=cut(cand,a,b)
    hx=hashlib.sha256(x.encode()).hexdigest()[:16]
    hy=hashlib.sha256(y.encode()).hexdigest()[:16]
    print(f"{name}: live={hx} candidate={hy}")
    if x!=y: raise SystemExit(f"ERROR: {name} changed; R804 refuses install")

# R804 must not alter the persistent YouTube transport, primary/backup URLs,
# FIFO recovery, H264 encoder, master publisher, fade graph or R801 MP3 swap.
same('INGEST','const STREAM_URL_OVERRIDE','const YOUTUBE_LIVE_URL')
same('TRANSPORT_CONSTANTS','const TRANSPORT_FATAL_RESTART_DELAY_MS_R746','const LIVE_CURRENT_FILE')
same('H264+PUBLISHER','function h264EncoderArgsR721()','async function visualLoopOffsetR735')
same('R801_MP3_ATOMIC','async function atomicReplaceNormalVideoFeederR801','async function ensureNormalVideoFeederR721')
same('FADE_GRAPH','function normalVideoFilterComplexR721','function h264EncoderArgsR721')
print('OK: YouTube transport + fade + R801 MP3 atomic handoff are byte-identical.')
PY

echo "=== BACKUP ==="
cp -a "$LIVE" "$BACKUP"
echo "$BACKUP"

echo "=== INSTALL R804 SERVER ==="
cat "$TMP_SERVER" > "$LIVE"
chown --reference="$BACKUP" "$LIVE"
chmod --reference="$BACKUP" "$LIVE"
node --check "$LIVE"

echo "=== CONTROLLED ONE-TIME RADIO RESTART ==="
# server.mjs is the live radio process, so one controlled service restart is required
# to activate R804. No unit/env/key/RTMPS settings are changed.
if ! systemctl restart andrik-radio.service; then
  echo "ERROR: R804 restart failed; rolling back" >&2
  cp -a "$BACKUP" "$LIVE"
  systemctl restart andrik-radio.service || true
  exit 1
fi

sleep 12
if [[ "$(systemctl is-active andrik-radio.service || true)" != "active" ]]; then
  echo "ERROR: R804 radio not active; rolling back" >&2
  cp -a "$BACKUP" "$LIVE"
  systemctl restart andrik-radio.service || true
  sleep 6
  systemctl status andrik-radio.service --no-pager -l | tail -n 120 || true
  exit 1
fi

RADIO_PID_AFTER="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"

echo "=== R804 ACTIVE ==="
grep -n "R804-STATION-SINGLE-WRITER\|station-r804-clean-cut-complete\|__r804StationCut" "$LIVE" | head -n 16

echo
echo "=== RADIO RESTART PROOF ==="
echo "radio active before : ${RADIO_ACTIVE_BEFORE:-unknown}"
echo "radio MainPID before: ${RADIO_PID_BEFORE:-0}"
echo "radio MainPID after : ${RADIO_PID_AFTER:-0}"
echo "NOTE: PID change is expected exactly once because server.mjs must reload."

echo
echo "=== SINGLE WEB AGENT CHECK (R803E PRESERVED) ==="
systemctl is-active andrik-radio-web.service 2>/dev/null || true
systemctl is-active andrik-radio-web-agent.service 2>/dev/null || true
ps -eo pid,ppid,etime,cmd | grep '[a]ndrik-radio-web' || true

echo
echo "=== CURRENT FFMPEG / RTMPS ==="
ps -eo pid,ppid,%cpu,%mem,stat,etime,cmd --sort=-%cpu | grep '[f]fmpeg' | head -n 10 || true
ss -tinp 2>/dev/null | grep ':443' | grep -E 'ffmpeg|youtube|google' | head -n 10 || true

echo
echo "=== R804 READY ==="
echo "Station handoff: ONE H264 writer only"
echo "Old normal feeder: SIGINT while still connected -> stdout EOF -> sink drain"
echo "New station feeder: already A/V-ready, connected only after clean old AU drain"
echo "Mid-NAL unpipe/SIGTERM at station boundary: REMOVED"
echo "Station handoff watchdog race: BLOCKED during cutover"
echo "R803E single diagnostic agent: preserved"
echo "R802 station integrity/self-heal: preserved"
echo "R801 MP3 atomic handoff: preserved"
echo "R799 fade: preserved"
echo "YouTube primary+backup transport/FIFO/bitrate: untouched"
echo "Durable evidence: /var/cache/andrik-radio-r622/diagnostics/r802-events.ndjson"
echo "BACKUP=$BACKUP"

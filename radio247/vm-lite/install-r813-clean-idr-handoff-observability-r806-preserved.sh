#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
LIVE="/opt/andrik-radio/radio247/server.mjs"
AGENT="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
RADIO_UNIT="andrik-radio.service"
AGENT_UNIT="andrik-radio-web.service"
BASE="http://127.0.0.1:8080"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${LIVE}.bak-before-r813-${STAMP}"
AGENT_BACKUP="${AGENT}.bak-before-r813-${STAMP}"
TMP_SERVER="$(mktemp --suffix=.mjs)"
TMP_AGENT="$(mktemp --suffix=.mjs)"
EVIDENCE="/var/cache/andrik-radio-r622/diagnostics/r813-before-${STAMP}.log"

cleanup(){ rm -f "$TMP_SERVER" "$TMP_AGENT"; }
trap cleanup EXIT

[ "${EUID}" -eq 0 ] || { echo "ERROR: run with sudo" >&2; exit 1; }
command -v node >/dev/null || { echo "ERROR: node not found" >&2; exit 1; }
command -v curl >/dev/null || { echo "ERROR: curl not found" >&2; exit 1; }
[ -f "$LIVE" ] || { echo "ERROR: $LIVE not found" >&2; exit 1; }

mkdir -p /var/cache/andrik-radio-r622/diagnostics

echo
echo "========================================================"
echo " R813 • CLEAN IDR MAKE-BEFORE-BREAK"
echo " + FULL DIAGNOSTICS + STREAM PROFILE"
echo "========================================================"

RADIO_PID_BEFORE="$(systemctl show "$RADIO_UNIT" -p MainPID --value 2>/dev/null || true)"

echo
echo "=== CAPTURE PRE-INSTALL EVIDENCE ==="
{
  echo "TIME=$(date -Is)"
  echo
  echo "===== STATUS ====="
  curl -fsS "$BASE/status" 2>/dev/null || true
  echo
  echo "===== JOURNAL 15 MIN ====="
  journalctl -u "$RADIO_UNIT" --since "-15 min" --no-pager -o short-iso -n 300 2>/dev/null || true
  echo
  echo "===== FFMPEG ====="
  ps -eo pid,ppid,%cpu,%mem,stat,etime,cmd --sort=-%cpu | grep '[f]fmpeg' | head -n 30 || true
  echo
  echo "===== RTMPS ====="
  ss -tnp 2>/dev/null | grep '^ESTAB' | grep ':443' | grep 'ffmpeg' || true
} > "$EVIDENCE"
echo "EVIDENCE=$EVIDENCE"

echo
echo "=== WAIT FOR SAFE MP3 WINDOW ==="
SAFE=0
for N in $(seq 1 120); do
  RAW="$(curl -fsS "$BASE/status" 2>/dev/null || true)"
  if [ -n "$RAW" ]; then
    CLIP="$(printf '%s' "$RAW" | python3 -c 'import json,sys
try:s=json.load(sys.stdin);print("1" if s.get("clipActive") else "0")
except Exception:print("1")')"
    if [ "$CLIP" = "0" ]; then SAFE=1; break; fi
  fi
  if [ "$N" = "1" ]; then echo "Сейчас видео/заставка — жду обычную MP3 автоматически..."; fi
  sleep 5
done
[ "$SAFE" = "1" ] || { echo "ERROR: no safe MP3 window within 10 minutes" >&2; exit 1; }
echo "SAFE MP3 WINDOW ✅"

echo
echo "=== DOWNLOAD R813 CANONICAL FILES ==="
curl -fsSL --retry 6 --retry-delay 2 \
  "${SITE_BASE}/radio247/server.mjs?t=$(date +%s)" -o "$TMP_SERVER"
curl -fsSL --retry 6 --retry-delay 2 \
  "${SITE_BASE}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?t=$(date +%s)" -o "$TMP_AGENT"

echo
echo "=== R813 MARKER GUARD ==="
grep -q "R813-CLEAN-IDR-HANDOFF" "$TMP_SERVER" || { echo "ERROR: server is not R813" >&2; exit 1; }
grep -q "r813-candidate-clean-idr-ready" "$TMP_SERVER" || { echo "ERROR: clean IDR bootstrap missing" >&2; exit 1; }
grep -q "R809/R813" "$TMP_SERVER" || { echo "ERROR: R809 split fade not preserved" >&2; exit 1; }
grep -q "streamProfileR813" "$TMP_SERVER" || { echo "ERROR: stream profile telemetry missing" >&2; exit 1; }
grep -q "streamProfileR813" "$TMP_AGENT" || { echo "ERROR: R813 profile not exposed by agent" >&2; exit 1; }
grep -q "diagnosticsR813" "$TMP_AGENT" || { echo "ERROR: R813 diagnostics passthrough missing" >&2; exit 1; }

node --check "$TMP_SERVER"
node --check "$TMP_AGENT"
echo "NODE CHECK ✅"

echo
echo "=== BACKUPS ==="
cp -a "$LIVE" "$BACKUP"
echo "RADIO BACKUP=$BACKUP"
if [ -f "$AGENT" ]; then
  cp -a "$AGENT" "$AGENT_BACKUP"
  echo "AGENT BACKUP=$AGENT_BACKUP"
fi

rollback(){
  set +e
  echo
  echo "=== R813 ROLLBACK ===" >&2
  cp -a "$BACKUP" "$LIVE" 2>/dev/null || true
  if [ -f "$AGENT_BACKUP" ]; then cp -a "$AGENT_BACKUP" "$AGENT" 2>/dev/null || true; fi
  systemctl restart "$RADIO_UNIT" >/dev/null 2>&1 || true
  systemctl restart "$AGENT_UNIT" >/dev/null 2>&1 || true
  echo "Rollback finished." >&2
}
trap 'rc=$?; if [ $rc -ne 0 ]; then rollback; fi; cleanup' EXIT

echo
echo "=== INSTALL SERVER + AGENT ==="
cat "$TMP_SERVER" > "$LIVE"
chown --reference="$BACKUP" "$LIVE"
chmod --reference="$BACKUP" "$LIVE"

if [ -f "$AGENT" ]; then
  cat "$TMP_AGENT" > "$AGENT"
  chown --reference="$AGENT_BACKUP" "$AGENT"
  chmod --reference="$AGENT_BACKUP" "$AGENT"
else
  install -m 0644 "$TMP_AGENT" "$AGENT"
fi

node --check "$LIVE"
node --check "$AGENT"

echo
echo "=== ONE CONTROLLED RADIO RESTART ==="
systemctl restart "$RADIO_UNIT"

for N in $(seq 1 30); do
  sleep 2
  if systemctl is-active --quiet "$RADIO_UNIT" && curl -fsS "$BASE/status" >/dev/null 2>&1; then
    echo "radio check $N/30 ✅"
    break
  fi
  [ "$N" -lt 30 ] || { echo "ERROR: radio/API did not recover" >&2; exit 1; }
done

echo
echo "=== RESTART WEB AGENT ONLY ==="
systemctl restart "$AGENT_UNIT"
sleep 5
systemctl is-active --quiet "$AGENT_UNIT" || {
  echo "ERROR: web agent failed" >&2
  exit 1
}

echo
echo "=== WAIT FOR RTMPS ==="
for N in $(seq 1 30); do
  RAW="$(curl -fsS "$BASE/status" 2>/dev/null || true)"
  if [ -n "$RAW" ]; then
    OK="$(printf '%s' "$RAW" | python3 -c 'import json,sys
try:
 s=json.load(sys.stdin)
 r=int(s.get("rtmpsEstablishedConnectionsR792") or 0)
 print("1" if s.get("publisherRunning") and s.get("videoFeederRunning") and s.get("transportHealthy") is not False and r>=1 else "0")
except Exception: print("0")')"
    if [ "$OK" = "1" ]; then break; fi
  fi
  sleep 2
done

RADIO_PID_AFTER="$(systemctl show "$RADIO_UNIT" -p MainPID --value 2>/dev/null || true)"

echo
echo "=== FINAL R813 STATUS ==="
curl -fsS "$BASE/status" | python3 -c '
import json,sys
s=json.load(sys.stdin)
p=s.get("streamProfileR813") or {}
v=p.get("video") or {}
a=p.get("audio") or {}
t=p.get("transport") or {}
cur=s.get("current") or {}
nxt=s.get("next") or {}
print("version            :",s.get("version"))
print("current            :",cur.get("title"))
print("next               :",nxt.get("title"))
print("videoFeederRunning :",s.get("videoFeederRunning"))
print("publisherRunning   :",s.get("publisherRunning"))
print("transportHealthy   :",s.get("transportHealthy"))
print("RTMPS              :",s.get("rtmpsEstablishedConnectionsR792"),"/",s.get("rtmpsExpectedConnectionsR792"))
print("VIDEO              :",v.get("codec"),v.get("width"),"x",v.get("height"),v.get("fps"),"fps",v.get("bitrate"))
print("AUDIO              :",a.get("codec"),a.get("sampleRate"),"Hz",a.get("channelLayout"),a.get("bitrate"))
print("HANDOFF            :",p.get("handoff",{}).get("mode"))
print("lastError          :",s.get("lastError") or "")
'

echo
echo "=== CLEAN-HANDOFF PROOF ==="
grep -n "R813-CLEAN-IDR-HANDOFF\|r813-candidate-clean-idr-ready\|__r813CleanHandoff\|R809/R813" "$LIVE" | head -n 30

echo
echo "=== RTMPS SOCKETS ==="
ss -tnp 2>/dev/null | grep '^ESTAB' | grep ':443' | grep 'ffmpeg' || true

echo
echo "========================================================"
echo " R813 READY"
echo "========================================================"
echo "RADIO PID BEFORE=$RADIO_PID_BEFORE"
echo "RADIO PID AFTER =$RADIO_PID_AFTER"
echo
echo "FIXED:"
echo "  MP3 candidate must contain complete SPS+PPS+IDR"
echo "  old LIVE H264 stays connected until stdout EOF/CLOSE"
echo "  generic exit handler cannot unpipe R813 handoff early"
echo "  R749 watchdog is guarded during intentional swap"
echo "  normal clips arm A/V BEFORE clean old-AU cut"
echo "  no SIGKILL is used on a LIVE MP3 handoff"
echo "  R809 fade-to-black / fade-from-black preserved"
echo "  R808-style moving-input corruption guards preserved"
echo
echo "OBSERVABILITY:"
echo "  full R803/R802 incident ring preserved"
echo "  streamProfileR813 exposed to control UI"
echo "  H264 1920x1080 25fps 6000k"
echo "  AAC-LC 44.1kHz stereo 160k"
echo "  FLV / RTMPS primary+backup"
echo
echo "EVIDENCE=$EVIDENCE"
echo "BACKUP=$BACKUP"
echo "========================================================"

trap cleanup EXIT

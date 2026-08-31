#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
LIVE="/opt/andrik-radio/radio247/server.mjs"
AGENT="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
RADIO_UNIT="andrik-radio.service"
AGENT_UNIT="andrik-radio-web.service"
BASE="http://127.0.0.1:8080"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${LIVE}.bak-before-r815-${STAMP}"
AGENT_BACKUP="${AGENT}.bak-before-r815-${STAMP}"
TMP_SERVER="$(mktemp --suffix=.mjs)"
TMP_AGENT="$(mktemp --suffix=.mjs)"
EVIDENCE="/var/cache/andrik-radio-r622/diagnostics/r815-before-${STAMP}.log"

cleanup(){ rm -f "$TMP_SERVER" "$TMP_AGENT"; }
trap cleanup EXIT

[ "${EUID}" -eq 0 ] || { echo "ERROR: run with sudo" >&2; exit 1; }
command -v node >/dev/null || { echo "ERROR: node not found" >&2; exit 1; }
command -v curl >/dev/null || { echo "ERROR: curl not found" >&2; exit 1; }
[ -f "$LIVE" ] || { echo "ERROR: $LIVE not found" >&2; exit 1; }
mkdir -p /var/cache/andrik-radio-r622/diagnostics

cat <<'HDR'
========================================================
 R815 • AU-GATED H264 HANDOFF
 + TITLE / PREVIOUS / NEXT SYNC
 + LONG MP3→MP3 FADE
 + R814/R813/R809 PRESERVED
========================================================
HDR

RADIO_PID_BEFORE="$(systemctl show "$RADIO_UNIT" -p MainPID --value 2>/dev/null || true)"

{
  echo "TIME=$(date -Is)"
  echo "===== STATUS ====="
  curl -fsS "$BASE/status" 2>/dev/null || true
  echo
  echo "===== JOURNAL ====="
  journalctl -u "$RADIO_UNIT" --since "-15 min" --no-pager -o short-iso -n 300 2>/dev/null || true
  echo
  echo "===== RTMPS ====="
  ss -tnp 2>/dev/null | grep '^ESTAB' | grep ':443' | grep 'ffmpeg' || true
} > "$EVIDENCE"
echo "EVIDENCE=$EVIDENCE"

echo
echo "=== WAIT FOR ORDINARY MP3 WINDOW ==="
SAFE=0
for N in $(seq 1 120); do
  RAW="$(curl -fsS "$BASE/status" 2>/dev/null || true)"
  if [ -n "$RAW" ]; then
    SAFE="$(printf '%s' "$RAW" | python3 -c 'import json,sys
try:
 s=json.load(sys.stdin)
 print("1" if (not s.get("clipActive") and s.get("publisherRunning")) else "0")
except Exception: print("0")')"
    [ "$SAFE" = "1" ] && break
  fi
  [ "$N" = "1" ] && echo "Сейчас не безопасное MP3-окно — жду автоматически..."
  sleep 5
done
[ "$SAFE" = "1" ] || { echo "ERROR: no safe MP3 window within 10 minutes" >&2; exit 1; }
echo "SAFE MP3 WINDOW ✅"

echo
echo "=== DOWNLOAD R815 CANONICAL FILES ==="
curl -fsSL --retry 6 --retry-delay 2 "${SITE_BASE}/radio247/server.mjs?t=$(date +%s)" -o "$TMP_SERVER"
curl -fsSL --retry 6 --retry-delay 2 "${SITE_BASE}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?t=$(date +%s)" -o "$TMP_AGENT"

echo
echo "=== R815 MARKER GUARD ==="
grep -q "R815-AU-GATED-H264-TITLE-PREVIEW-SYNC" "$TMP_SERVER" || { echo "ERROR: server is not R815" >&2; exit 1; }
grep -q "r815-au-gate-start" "$TMP_SERVER" || { echo "ERROR: AU gate missing" >&2; exit 1; }
grep -q "r815-old-au-gated" "$TMP_SERVER" || { echo "ERROR: complete-AU cut proof missing" >&2; exit 1; }
grep -q "r815-mp3-visual-sync-retry" "$TMP_SERVER" || { echo "ERROR: title/visual sync retry missing" >&2; exit 1; }
grep -q "r815-track-held-for-visual-sync" "$TMP_SERVER" || { echo "ERROR: no-skip track hold missing" >&2; exit 1; }
grep -q "MP3_BOUNDARY_FADE_OUT_SECONDS_R815 = 1.35" "$TMP_SERVER" || { echo "ERROR: R815 fade-out missing" >&2; exit 1; }
grep -q "MP3_BOUNDARY_FADE_IN_SECONDS_R815 = 1.35" "$TMP_SERVER" || { echo "ERROR: R815 fade-in missing" >&2; exit 1; }
grep -q "diagnosticsR815" "$TMP_AGENT" || { echo "ERROR: R815 diagnostics alias missing" >&2; exit 1; }
node --check "$TMP_SERVER"
node --check "$TMP_AGENT"
echo "NODE CHECK ✅"

echo
echo "=== BACKUPS ==="
cp -a "$LIVE" "$BACKUP"
[ -f "$AGENT" ] && cp -a "$AGENT" "$AGENT_BACKUP" || true
echo "RADIO BACKUP=$BACKUP"
[ -f "$AGENT_BACKUP" ] && echo "AGENT BACKUP=$AGENT_BACKUP" || true

rollback(){
  set +e
  echo "=== R815 ROLLBACK ===" >&2
  cp -a "$BACKUP" "$LIVE" 2>/dev/null || true
  [ -f "$AGENT_BACKUP" ] && cp -a "$AGENT_BACKUP" "$AGENT" 2>/dev/null || true
  systemctl restart "$RADIO_UNIT" >/dev/null 2>&1 || true
  systemctl restart "$AGENT_UNIT" >/dev/null 2>&1 || true
  echo "Rollback finished." >&2
}
trap 'rc=$?; if [ $rc -ne 0 ]; then rollback; fi; cleanup' EXIT

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
for N in $(seq 1 40); do
  sleep 2
  if systemctl is-active --quiet "$RADIO_UNIT" && curl -fsS "$BASE/status" >/dev/null 2>&1; then
    echo "radio API $N/40 ✅"
    break
  fi
  [ "$N" -lt 40 ] || { echo "ERROR: radio/API did not recover" >&2; exit 1; }
done

echo
echo "=== RESTART WEB AGENT ONLY ==="
systemctl restart "$AGENT_UNIT"
sleep 4
systemctl is-active --quiet "$AGENT_UNIT" || { echo "ERROR: web agent failed" >&2; exit 1; }

echo
echo "=== WAIT FOR RTMPS ==="
for N in $(seq 1 45); do
  RAW="$(curl -fsS "$BASE/status" 2>/dev/null || true)"
  if [ -n "$RAW" ]; then
    OK="$(printf '%s' "$RAW" | python3 -c 'import json,sys
try:
 s=json.load(sys.stdin); r=int(s.get("rtmpsEstablishedConnectionsR792") or 0)
 print("1" if s.get("publisherRunning") and s.get("videoFeederRunning") and r>=1 else "0")
except Exception: print("0")')"
    [ "$OK" = "1" ] && break
  fi
  sleep 2
done

RADIO_PID_AFTER="$(systemctl show "$RADIO_UNIT" -p MainPID --value 2>/dev/null || true)"

echo
echo "=== FINAL R815 STATUS ==="
curl -fsS "$BASE/status" | python3 -c '
import json,sys
s=json.load(sys.stdin); p=s.get("streamProfileR815") or s.get("streamProfileR814") or s.get("streamProfileR813") or {}; v=p.get("video") or {}; a=p.get("audio") or {}
cur=s.get("current") or {}; nxt=s.get("next") or {}
print("version            :",s.get("version"))
print("current            :",cur.get("title"))
print("next               :",nxt.get("title"))
print("producerRunning    :",s.get("producerRunning"))
print("videoFeederRunning :",s.get("videoFeederRunning"))
print("publisherRunning   :",s.get("publisherRunning"))
print("transportHealthy   :",s.get("transportHealthy"))
print("RTMPS              :",s.get("rtmpsEstablishedConnectionsR792"),"/",s.get("rtmpsExpectedConnectionsR792"))
print("VIDEO              :",v.get("codec"),v.get("width"),"x",v.get("height"),v.get("fps"),"fps",v.get("bitrate"))
print("AUDIO              :",a.get("codec"),a.get("sampleRate"),"Hz",a.get("channelLayout"),a.get("bitrate"))
print("HANDOFF            :",s.get("videoHandoffMode"))
print("MP3 FADE           :",s.get("mp3BoundaryFadeMode"))
print("lastError          :",s.get("lastError") or "")
print("lastWarning        :",s.get("lastWarning") or "")
'

echo
echo "=== R815 PROOF ==="
grep -n "r815-au-gate-start\|r815-old-au-gated\|r815-mp3-visual-sync-retry\|MP3_BOUNDARY_FADE_OUT_SECONDS_R815" "$LIVE" | head -n 40

echo
echo "=== RTMPS SOCKETS ==="
ss -tnp 2>/dev/null | grep '^ESTAB' | grep ':443' | grep 'ffmpeg' || true

echo
echo "========================================================"
echo " R815 READY"
echo "========================================================"
echo "RADIO PID BEFORE=$RADIO_PID_BEFORE"
echo "RADIO PID AFTER =$RADIO_PID_AFTER"
echo "FIXED:"
echo "  old H264 leaves LIVE ONLY at next complete AUD boundary"
echo "  stale old title / PREVIOUS / NEXT feeder cannot survive a handoff"
echo "  stubborn old FFmpeg is killed only AFTER it is detached OFF-LIVE"
echo "  new MP3 is held until its visual/title feeder is actually committed"
echo "  selected track is NOT skipped when visual sync retries"
echo "  MP3→MP3 fade: 1.35s out + 0.25s black + 1.35s in"
echo "  R814 queued-backpressure + clip retry lock preserved"
echo "  R813 diagnostics + R809/R808/R806/R805/R804 preserved"
echo "EVIDENCE=$EVIDENCE"
echo "BACKUP=$BACKUP"
echo "========================================================"

trap cleanup EXIT

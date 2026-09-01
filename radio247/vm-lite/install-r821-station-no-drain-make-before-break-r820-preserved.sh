#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
LIVE="/opt/andrik-radio/radio247/server.mjs"
RADIO_UNIT="andrik-radio.service"
BASE="http://127.0.0.1:8080"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${LIVE}.bak-before-r821-${STAMP}"
TMP="$(mktemp --suffix=.mjs)"
EVIDENCE="/var/cache/andrik-radio-r622/diagnostics/r821-before-${STAMP}.log"
cleanup(){ rm -f "$TMP" /tmp/r821-status.json; }
trap cleanup EXIT

[ "${EUID}" -eq 0 ] || { echo "ERROR: run with sudo" >&2; exit 1; }
for C in node curl python3 systemctl journalctl ss; do command -v "$C" >/dev/null || { echo "ERROR: $C not found" >&2; exit 1; }; done
[ -f "$LIVE" ] || { echo "ERROR: $LIVE not found" >&2; exit 1; }
mkdir -p /var/cache/andrik-radio-r622/diagnostics

cat <<'HDR'
========================================================
 R821 • STATION NO-DRAIN MAKE-BEFORE-BREAK
 R820 MASTER PTS / R819 FULLSCREEN / R814 FADE PRESERVED
========================================================
HDR

{
  echo "TIME=$(date -Is)"
  echo "===== STATUS BEFORE ====="
  curl -fsS --max-time 3 "$BASE/status" 2>/dev/null || true
  echo
  echo "===== JOURNAL BEFORE ====="
  journalctl -u "$RADIO_UNIT" --since "-20 min" --no-pager -o short-iso -n 320 2>/dev/null || true
  echo
  echo "===== RTMPS BEFORE ====="
  ss -tnp 2>/dev/null | grep '^ESTAB' | grep ':443' | grep 'ffmpeg' || true
} > "$EVIDENCE"
echo "EVIDENCE=$EVIDENCE"

echo
echo "=== WAIT FOR SAFE ORDINARY MP3 WINDOW ==="
SAFE=0
for N in $(seq 1 120); do
  RAW="$(curl -fsS --max-time 2 "$BASE/status" 2>/dev/null || true)"
  if [ -n "$RAW" ]; then
    SAFE="$(printf '%s' "$RAW" | python3 -c 'import json,sys
try:
 s=json.load(sys.stdin)
 print("1" if (not s.get("clipActive") and s.get("publisherRunning")) else "0")
except Exception: print("0")')"
    [ "$SAFE" = "1" ] && break
  fi
  [ "$N" = "1" ] && echo "Заставка/клип сейчас активны — жду ближайшее безопасное MP3-окно автоматически..."
  sleep 5
done
[ "$SAFE" = "1" ] || { echo "ERROR: no safe MP3 window within 10 minutes" >&2; exit 1; }
echo "SAFE MP3 WINDOW ✅"

echo
echo "=== DOWNLOAD R821 CANONICAL SERVER ==="
curl -fsSL --retry 6 --retry-delay 2 "${SITE_BASE}/radio247/server.mjs?t=$(date +%s)" -o "$TMP"

python3 - "$TMP" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text(encoding='utf-8')
required=[
 "R821-STATION-NO-DRAIN-MAKE-BEFORE-BREAK",
 "version: 'R821-STATION-NO-DRAIN-MAKE-BEFORE-BREAK-R820-PRESERVED'",
 "STATION_LEGACY_DRAIN_DISABLED_R821 = true",
 "r821-station-candidate-av-ready-no-drain",
 "r821-station-no-drain-promoted",
 "R821-STATION-RAWVIDEO-LIVE-NO-DRAIN",
 "R820-DETERMINISTIC-MASTER-PTS-LOCK",
 "LIVE_FULL_FRAME_GEOMETRY_R819",
 "MP3_BOUNDARY_FADE_OUT_SECONDS_R814 = 1.10",
 "MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814 = 0.20",
 "MP3_BOUNDARY_FADE_IN_SECONDS_R814 = 1.15",
 "const VIDEO_INPUT_QUEUE_PACKETS_R732 = 24;",
 "const AUDIO_INPUT_QUEUE_PACKETS_R732 = 8;",
]
missing=[x for x in required if x not in s]
forbidden=[
 "station-r804-sink-drain",
 "station-r804-clean-cut-start",
 "station-r804-clean-cut-complete",
 "station-r804-clean-cut-timeout",
 "STATION_PIPE_DRAIN_TIMEOUT_MS_R804",
 "STATION_H264_CLEAN_STOP_TIMEOUT_MS_R804",
]
present=[x for x in forbidden if x in s]
if missing:
 print('ERROR: R821 guard missing:')
 for x in missing: print(' -',x)
 raise SystemExit(31)
if present:
 print('ERROR: legacy station drain path still present:')
 for x in present: print(' -',x)
 raise SystemExit(32)
print('R821 STATIC GUARD ✅')
print('legacy station sink-drain path ABSENT ✅')
print('station candidate A+V readiness gate PRESENT ✅')
print('R820 master PTS lock preserved ✅')
print('R819 fullscreen/no-crop geometry preserved ✅')
print('R814 MP3 fade 1.10 / 0.20 / 1.15 preserved ✅')
PY
node --check "$TMP"

echo
echo "=== BACKUP ==="
cp -a "$LIVE" "$BACKUP"
echo "BACKUP=$BACKUP"

rollback(){
  set +e
  echo "=== R821 ROLLBACK ===" >&2
  cp -a "$BACKUP" "$LIVE" 2>/dev/null || true
  systemctl restart "$RADIO_UNIT" >/dev/null 2>&1 || true
  echo "Rollback finished." >&2
}
trap 'rc=$?; if [ $rc -ne 0 ]; then rollback; fi; cleanup' EXIT

cat "$TMP" > "$LIVE"
chown --reference="$BACKUP" "$LIVE"
chmod --reference="$BACKUP" "$LIVE"
node --check "$LIVE"

echo
echo "=== ONE CONTROLLED RADIO RESTART ==="
systemctl restart "$RADIO_UNIT"

READY=0
for N in $(seq 1 90); do
  if systemctl is-active --quiet "$RADIO_UNIT" && curl -fsS --max-time 2 "$BASE/status" >/tmp/r821-status.json 2>/dev/null; then
    if python3 - /tmp/r821-status.json <<'PY' >/dev/null 2>&1
import json,sys
s=json.load(open(sys.argv[1]))
assert str(s.get('version') or '').startswith('R821-')
assert s.get('publisherRunning') is True
assert s.get('stationLegacyDrainDisabledR821') is True
PY
    then READY=1; break; fi
  fi
  sleep 1
done

if [ "$READY" != 1 ]; then
  echo "ERROR: R821 did not become ready" >&2
  exit 40
fi

sleep 8

echo
echo "=== FINAL R821 STATUS ==="
curl -fsS --max-time 3 "$BASE/status" | python3 -c '
import json,sys
s=json.load(sys.stdin); c=s.get("current") or {}; n=s.get("next") or {}
print("version          :",s.get("version"))
print("current          :",c.get("title"))
print("next             :",n.get("title"))
print("producer         :",s.get("producerRunning"))
print("publisher        :",s.get("publisherRunning"))
print("video            :",s.get("videoFeederRunning"))
print("RTMPS            :",s.get("rtmpsEstablishedConnectionsR792"),"/",s.get("rtmpsExpectedConnectionsR792"))
print("transportHealthy :",s.get("transportHealthy"))
print("station drain    :", "DISABLED" if s.get("stationLegacyDrainDisabledR821") else "ERROR")
print("station handoff  :",s.get("stationHandoffModeR821"))
print("station promotes :",s.get("stationNoDrainPromotionsR821"))
print("PTS errors       :",s.get("masterTimestampErrorCount"))
print("lastError        :",s.get("lastError") or "")
print("lastWarning      :",s.get("lastWarning") or "")
'

echo
echo "=== LEGACY STATION DRAIN CHECK ==="
if grep -n -E 'station-r804-sink-drain|station-r804-clean-cut|STATION_PIPE_DRAIN_TIMEOUT_MS_R804|STATION_H264_CLEAN_STOP_TIMEOUT_MS_R804' "$LIVE"; then
  echo "ERROR: legacy station drain code found after install" >&2
  exit 50
else
  echo "ABSENT ✅"
fi

echo
echo "=== RTMPS SOCKETS ==="
ss -tnp 2>/dev/null | grep '^ESTAB' | grep ':443' | grep 'ffmpeg' || true

echo
echo "========================================================"
echo " R821 READY ✅"
echo " Station sink-drain: DISABLED"
echo " Make-before-break A+V gate: ENABLED"
echo " Persistent x264/RTMPS master: PRESERVED"
echo " Fullscreen/no-crop: PRESERVED"
echo " MP3 fade 1.10/0.20/1.15: PRESERVED"
echo " Evidence: $EVIDENCE"
echo " Backup  : $BACKUP"
echo "========================================================"

trap cleanup EXIT

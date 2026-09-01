#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
LIVE="/opt/andrik-radio/radio247/server.mjs"
RADIO_UNIT="andrik-radio.service"
BASE="http://127.0.0.1:8080"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${LIVE}.bak-before-r820-${STAMP}"
TMP="$(mktemp --suffix=.mjs)"
trap 'rm -f "$TMP"' EXIT

[ "${EUID}" -eq 0 ] || { echo "ERROR: run with sudo" >&2; exit 1; }
for C in node curl python3 systemctl; do command -v "$C" >/dev/null || { echo "ERROR: $C not found" >&2; exit 1; }; done
[ -f "$LIVE" ] || { echo "ERROR: $LIVE not found" >&2; exit 1; }

echo "=== R820 MASTER PTS LOCK ==="
curl -fsSL --retry 6 --retry-delay 2 "${SITE_BASE}/radio247/server.mjs?t=$(date +%s)" -o "$TMP"

python3 - "$TMP" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text(encoding='utf-8')
required=[
 "R820-DETERMINISTIC-MASTER-PTS-LOCK",
 "version: 'R820-MASTER-PTS-LOCK-R819-R818-R816-R814-PRESERVED'",
 "const VIDEO_INPUT_QUEUE_PACKETS_R732 = 24;",
 "const AUDIO_INPUT_QUEUE_PACKETS_R732 = 8;",
 "settb=expr=1/90000,setpts=N/(${VIDEO_FPS}*TB)",
 "asettb=expr=1/${AUDIO_SAMPLE_RATE},asetpts=N/SR/TB",
 "'-fps_mode:v','cfr'",
 "'-enc_time_base:v',`1:${VIDEO_FPS}`",
 "MP3_BOUNDARY_FADE_OUT_SECONDS_R814 = 1.10",
 "MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814 = 0.20",
 "MP3_BOUNDARY_FADE_IN_SECONDS_R814 = 1.15",
 "LIVE_FULL_FRAME_GEOMETRY_R819",
]
missing=[x for x in required if x not in s]
if missing:
 print('ERROR: R820 guard failed:')
 for x in missing: print(' -',x)
 raise SystemExit(31)
print('R820 STATIC GUARD ✅')
print('VIDEO queue 24 ✅  AUDIO queue 8 ✅')
print('R819 fullscreen geometry untouched ✅')
print('R814 fade 1.10 / 0.20 / 1.15 untouched ✅')
print('Explicit master video+audio PTS lock ✅')
PY
node --check "$TMP"

echo "=== BACKUP ==="
cp -a "$LIVE" "$BACKUP"
echo "$BACKUP"

cp "$TMP" "$LIVE"
chown --reference="$BACKUP" "$LIVE"
chmod --reference="$BACKUP" "$LIVE"
node --check "$LIVE"

# Remove the experimental external title synchronizer if it exists. R820 uses the
# built-in PTS-locked title handoff from the radio engine only.
systemctl disable --now andrik-title-sync.service >/dev/null 2>&1 || true

echo "=== ONE RADIO RESTART ==="
systemctl restart "$RADIO_UNIT"

READY=0
for N in $(seq 1 90); do
  if systemctl is-active --quiet "$RADIO_UNIT" && curl -fsS --max-time 2 "$BASE/status" >/tmp/r820-status.json 2>/dev/null; then
    if python3 - /tmp/r820-status.json <<'PY' >/dev/null 2>&1
import json,sys
s=json.load(open(sys.argv[1]))
assert str(s.get('version') or '').startswith('R820-')
assert s.get('publisherRunning') is True
PY
    then READY=1; break; fi
  fi
  sleep 1
done

if [ "$READY" != 1 ]; then
  echo "ERROR: R820 did not become ready; restoring backup" >&2
  cp -a "$BACKUP" "$LIVE"
  systemctl restart "$RADIO_UNIT" || true
  exit 40
fi

sleep 8

echo "=== RESULT ==="
curl -fsS --max-time 3 "$BASE/status" | python3 -c '
import json,sys
s=json.load(sys.stdin); c=s.get("current") or {}; n=s.get("next") or {}
print("version   :",s.get("version"))
print("current   :",c.get("title"))
print("next      :",n.get("title"))
print("producer  :",s.get("producerRunning"))
print("publisher :",s.get("publisherRunning"))
print("video     :",s.get("videoFeederRunning"))
print("RTMPS     :",s.get("rtmpsEstablishedConnectionsR792"),"/",s.get("rtmpsExpectedConnectionsR792"))
print("PTS mode  :",s.get("masterTimestampMode"))
print("PTS errors:",s.get("masterTimestampErrorCount"))
print("error     :",s.get("lastError") or "")
'

echo "=== RECENT TIMESTAMP/STALLED ERRORS ==="
journalctl -u "$RADIO_UNIT" --since "-2 min" --no-pager 2>/dev/null | grep -Ei 'Timestamps are unset|NO-PROGRESS|STREAM STALL' || echo "NONE ✅"

echo "=== R820 READY ==="
echo "Backup: $BACKUP"
rm -f /tmp/r820-status.json

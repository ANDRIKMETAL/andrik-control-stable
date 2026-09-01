#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
LIVE="/opt/andrik-radio/radio247/server.mjs"
GOLDEN="/opt/andrik-radio/radio247/server-r829-golden.mjs"
RADIO_UNIT="andrik-radio.service"
BASE="http://127.0.0.1:8080"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${LIVE}.bak-before-r829-${STAMP}"
TMP="$(mktemp --suffix=.mjs)"
EVIDENCE="/var/cache/andrik-radio-r622/diagnostics/r829-before-${STAMP}.log"
GUARD="/usr/local/sbin/andrik-radio-r829-golden-guard"
DROP="/etc/systemd/system/andrik-radio.service.d/50-r829-golden-lock.conf"
STATUS_TMP="/tmp/r829-status.json"
cleanup(){ rm -f "$TMP" "$STATUS_TMP"; }
trap cleanup EXIT

[ "${EUID}" -eq 0 ] || { echo "ERROR: run with sudo" >&2; exit 1; }
for C in node curl python3 systemctl journalctl ss sha256sum cmp; do command -v "$C" >/dev/null || { echo "ERROR: $C not found" >&2; exit 1; }; done
[ -f "$LIVE" ] || { echo "ERROR: $LIVE not found" >&2; exit 1; }
mkdir -p /var/cache/andrik-radio-r622/diagnostics /etc/systemd/system/andrik-radio.service.d

cat <<'HDR'
======================================================================
 R829 • GOLDEN NOCROP STABILITY BUILD
 FULL 1920x1080 HARD LOCK + R828 + R827 + R826 + R821/R820/R814
======================================================================
HDR

{
  echo "TIME=$(date -Is)"
  echo "===== STATUS BEFORE ====="
  curl -fsS --max-time 3 "$BASE/status" 2>/dev/null || true
  echo
  echo "===== JOURNAL BEFORE ====="
  journalctl -u "$RADIO_UNIT" --since "-20 min" --no-pager -o short-iso -n 360 2>/dev/null || true
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
  [ "$N" = "1" ] && echo "Клип/заставка активны — жду безопасное MP3-окно автоматически..."
  sleep 5
done
[ "$SAFE" = "1" ] || { echo "ERROR: no safe MP3 window within 10 minutes" >&2; exit 1; }
echo "SAFE MP3 WINDOW ✅"

echo
echo "=== DOWNLOAD R829 CANONICAL SERVER ==="
curl -fsSL --retry 6 --retry-delay 2 "${SITE_BASE}/radio247/server.mjs?t=$(date +%s)" -o "$TMP"

python3 - "$TMP" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text(encoding='utf-8')
required=[
 "version: 'R829-GOLDEN-NOCROP-R828-R827-R826-R821-PRESERVED'",
 "scale=1920:1080:flags=lanczos,setsar=1",
 "goldenNoCropLockR829: true",
 "falseFrameStallKillDisabledR829: true",
 "clipCommitLockR827: true",
 "stationIntegrityLightR828: true",
 "R828-PERSISTENT-STATION-INTEGRITY",
 "station-integrity-trusted-r828",
 "station-integrity-persist-hit-r828",
 "r827-insert-commit-locked",
 "r827-committed-insert-eof-no-retry",
 "r827-committed-insert-error-no-retry",
 "R827-SHUTDOWN-NO-CLIP-RETRY",
 "a non-NULL packet sent after an EOF",
 "failed to send packet to filter extract_extradata",
 "STATION_LEGACY_DRAIN_DISABLED_R821 = true",
 "r821-station-candidate-av-ready-no-drain",
 "r821-station-no-drain-promoted",
 "R820-DETERMINISTIC-MASTER-PTS-LOCK",
 "MP3_BOUNDARY_FADE_OUT_SECONDS_R814 = 1.10",
 "MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814 = 0.20",
 "MP3_BOUNDARY_FADE_IN_SECONDS_R814 = 1.15",
 "const VIDEO_INPUT_QUEUE_PACKETS_R732 = 24;",
 "const AUDIO_INPUT_QUEUE_PACKETS_R732 = 8;",
]
forbidden=[
 "force_original_aspect_ratio=decrease",
 "force_original_aspect_ratio=increase",
 "crop=1920:1080",
 "pad=1920:1080",
 "r823-live-frame-stall",
 "process.exit(77)",
 "station-r804-sink-drain",
 "station-r804-clean-cut-start",
 "STATION_PIPE_DRAIN_TIMEOUT_MS_R804",
 "STATION_H264_CLEAN_STOP_TIMEOUT_MS_R804",
]
missing=[x for x in required if x not in s]
present=[x for x in forbidden if x in s]
if missing:
 print('ERROR: R829 required markers missing:')
 for x in missing: print(' -',x)
 raise SystemExit(31)
if present:
 print('ERROR: R829 forbidden legacy/crop tokens found:')
 for x in present: print(' -',x)
 raise SystemExit(32)
print('R829 STATIC GUARD ✅')
print('crop/pad/aspect-ratio branches ABSENT ✅')
print('false R823 frame-stall kill ABSENT ✅')
print('R827 committed insert replay lock PRESENT ✅')
print('R828 station repeated full-decode removed ✅')
print('R821 station no-drain PRESENT ✅')
print('R814 fade 1.10 / 0.20 / 1.15 PRESENT ✅')
PY
node --check "$TMP"

echo
echo "=== BACKUP CURRENT LIVE ==="
cp -a "$LIVE" "$BACKUP"
echo "BACKUP=$BACKUP"

rollback(){
  set +e
  echo "=== R829 ROLLBACK ===" >&2
  cp -a "$BACKUP" "$LIVE" 2>/dev/null || true
  rm -f "$DROP" "$GUARD" "$GOLDEN" 2>/dev/null || true
  systemctl daemon-reload >/dev/null 2>&1 || true
  systemctl restart "$RADIO_UNIT" >/dev/null 2>&1 || true
  echo "Rollback finished." >&2
}
trap 'rc=$?; if [ $rc -ne 0 ]; then rollback; fi; cleanup' EXIT

# Remove the previous ad-hoc guards. R829 replaces all of them with one golden guard.
rm -f \
  /etc/systemd/system/andrik-radio.service.d/20-fullscreen-lock-r824.conf \
  /etc/systemd/system/andrik-radio.service.d/30-r826-permanent-guard.conf \
  /etc/systemd/system/andrik-radio.service.d/40-r828-integrity-guard.conf \
  /usr/local/sbin/andrik-fullscreen-lock-r824.sh \
  /usr/local/sbin/andrik-radio-r826-guard \
  /usr/local/sbin/andrik-radio-r828-integrity-guard \
  2>/dev/null || true

cat "$TMP" > "$LIVE"
chown --reference="$BACKUP" "$LIVE"
chmod --reference="$BACKUP" "$LIVE"
node --check "$LIVE"

# Golden immutable copy: every future radio restart restores the COMPLETE R829 stack,
# not just fullscreen constants. This prevents an old/manual patch from silently
# bringing back crop, R823 false kill, old clip retry, or heavy station decode.
cp -a "$LIVE" "$GOLDEN"
chmod 0644 "$GOLDEN"

cat > "$GUARD" <<'GUARDSH'
#!/usr/bin/env bash
set -Eeuo pipefail
LIVE=/opt/andrik-radio/radio247/server.mjs
GOLDEN=/opt/andrik-radio/radio247/server-r829-golden.mjs
[ -s "$GOLDEN" ] || { echo "R829 GUARD: golden server missing" >&2; exit 91; }
node --check "$GOLDEN" >/dev/null
if [ ! -s "$LIVE" ] || ! cmp -s "$LIVE" "$GOLDEN"; then
  cp -a "$GOLDEN" "$LIVE"
  echo "R829 GUARD: restored complete golden server.mjs"
fi
node --check "$LIVE" >/dev/null
python3 - "$LIVE" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text(encoding='utf-8')
required=[
 "version: 'R829-GOLDEN-NOCROP-R828-R827-R826-R821-PRESERVED'",
 "scale=1920:1080:flags=lanczos,setsar=1",
 "R828-PERSISTENT-STATION-INTEGRITY",
 "r827-insert-commit-locked",
 "failed to send packet to filter extract_extradata",
 "STATION_LEGACY_DRAIN_DISABLED_R821 = true",
]
forbidden=[
 "force_original_aspect_ratio=decrease",
 "force_original_aspect_ratio=increase",
 "crop=1920:1080",
 "pad=1920:1080",
 "r823-live-frame-stall",
 "process.exit(77)",
]
if any(x not in s for x in required) or any(x in s for x in forbidden):
 raise SystemExit(92)
PY
GUARDSH
chmod 0755 "$GUARD"

cat > "$DROP" <<EOF
[Service]
ExecStartPre=+$GUARD
EOF

systemctl daemon-reload

echo
echo "=== GOLDEN HASH ==="
sha256sum "$LIVE" "$GOLDEN"
cmp -s "$LIVE" "$GOLDEN" && echo "LIVE == GOLDEN ✅"

echo
echo "=== ONE CONTROLLED RADIO RESTART ==="
systemctl restart "$RADIO_UNIT"

READY=0
for N in $(seq 1 100); do
  if systemctl is-active --quiet "$RADIO_UNIT" && curl -fsS --max-time 2 "$BASE/status" >"$STATUS_TMP" 2>/dev/null; then
    if python3 - "$STATUS_TMP" <<'PY' >/dev/null 2>&1
import json,sys
s=json.load(open(sys.argv[1]))
assert str(s.get('version') or '').startswith('R829-')
assert s.get('publisherRunning') is True
assert s.get('stationLegacyDrainDisabledR821') is True
assert s.get('goldenNoCropLockR829') is True
assert s.get('falseFrameStallKillDisabledR829') is True
assert s.get('clipCommitLockR827') is True
assert s.get('stationIntegrityLightR828') is True
PY
    then READY=1; break; fi
  fi
  sleep 1
done
[ "$READY" = 1 ] || { echo "ERROR: R829 did not become ready" >&2; exit 40; }

sleep 8

echo
echo "=== FINAL R829 STATUS ==="
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
print("NO CROP golden   :",s.get("goldenNoCropLockR829"))
print("false stall kill :",s.get("falseFrameStallKillDisabledR829"))
print("clip commit R827 :",s.get("clipCommitLockR827"))
print("station check R828:",s.get("stationIntegrityLightR828"))
print("station drain    :","DISABLED" if s.get("stationLegacyDrainDisabledR821") else "ERROR")
print("lastError        :",s.get("lastError") or "")
print("lastWarning      :",s.get("lastWarning") or "")
'

echo
echo "=== ABSOLUTE CROP/PAD BAN ==="
if grep -nE 'force_original_aspect_ratio=(decrease|increase)|crop=1920:1080|pad=1920:1080|r823-live-frame-stall|process\.exit\(77\)' "$LIVE"; then
  echo "ERROR: forbidden geometry/false-stall code found" >&2
  exit 50
else
  echo "ABSENT ✅"
fi

echo
echo "=== FULLSCREEN CONSTANTS ==="
grep -nE 'FULL_FRAME_FILTER_R787|LIVE_FULL_FRAME_FILTER_R794|LIVE_FULL_FRAME_GEOMETRY_R819' "$LIVE" | head -5

echo
echo "=== R827/R828 MARKERS ==="
grep -nE 'r827-insert-commit-locked|r827-committed-insert-eof-no-retry|R828-PERSISTENT-STATION-INTEGRITY|station-integrity-trusted-r828' "$LIVE" | head -12

echo
echo "=== RTMPS SOCKETS ==="
ss -tnp 2>/dev/null | grep '^ESTAB' | grep ':443' | grep 'ffmpeg' || true

echo
echo "======================================================================"
echo " R829 READY ✅"
echo " HARD FULL 1920x1080: BUILT INTO CODE"
echo " CROP/PAD/ASPECT FALLBACK: ABSENT"
echo " GOLDEN FULL SERVER RESTORE BEFORE EVERY START: ENABLED"
echo " FALSE R823 FRAME-STALL KILL: ABSENT"
echo " REAL FLV/EOF SELF-HEAL: ENABLED"
echo " R827 AFTER-LIVE INSERT REPLAY: FORBIDDEN"
echo " R828 REPEATED STATION FULL-DECODE: FORBIDDEN"
echo " R821 STATION SINK-DRAIN: DISABLED"
echo " R814 FADE 1.10 / 0.20 / 1.15: PRESERVED"
echo " Evidence: $EVIDENCE"
echo " Backup  : $BACKUP"
echo " Golden  : $GOLDEN"
echo "======================================================================"

trap cleanup EXIT

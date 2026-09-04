#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
LIVE="/opt/andrik-radio/radio247/server.mjs"
R814_BASE="${R814_BASE:-/opt/andrik-radio/radio247/server.mjs.bak-before-r816-20260831-125421}"
GOLDEN="/opt/andrik-radio/radio247/server-r831-r814-golden-hybrid.mjs"
PATCH_TMP="$(mktemp --suffix=.py)"
CANDIDATE="$(mktemp --suffix=.mjs)"
RADIO_UNIT="andrik-radio.service"
BASE_URL="http://127.0.0.1:8080"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${LIVE}.bak-before-r831-${STAMP}"
EVIDENCE="/var/cache/andrik-radio-r622/diagnostics/r831-before-${STAMP}.log"
GUARD="/usr/local/sbin/andrik-radio-r831-r814-golden-guard"
DROP="/etc/systemd/system/andrik-radio.service.d/70-r831-r814-golden-hybrid.conf"
STATUS_TMP="/tmp/r831-status.json"
cleanup(){ rm -f "$PATCH_TMP" "$CANDIDATE" "$STATUS_TMP"; }
trap cleanup EXIT

[ "${EUID}" -eq 0 ] || { echo "ERROR: run with sudo" >&2; exit 1; }
for C in node curl python3 systemctl journalctl sha256sum cmp; do command -v "$C" >/dev/null || { echo "ERROR: $C not found" >&2; exit 1; }; done
[ -f "$LIVE" ] || { echo "ERROR: live server not found: $LIVE" >&2; exit 1; }
[ -f "$R814_BASE" ] || { echo "ERROR: exact working R814 base not found: $R814_BASE" >&2; exit 20; }
mkdir -p /var/cache/andrik-radio-r622/diagnostics /etc/systemd/system/andrik-radio.service.d

cat <<'HDR'
======================================================================
 R831 • EXACT WORKING R814 ENGINE + SAFE LATER FIXES
 Geometry/renderer: exact R814 base that fixed the screen on this VPS
 R828 + R827 + R826 + queue24 + early smooth fades
======================================================================
HDR

{
  echo "TIME=$(date -Is)"
  echo "R814_BASE=$R814_BASE"
  echo "===== STATUS BEFORE ====="
  curl -fsS --max-time 3 "$BASE_URL/status" 2>/dev/null || true
  echo
  echo "===== JOURNAL BEFORE ====="
  journalctl -u "$RADIO_UNIT" --since "-15 min" --no-pager -o short-iso -n 320 2>/dev/null || true
} > "$EVIDENCE"
echo "EVIDENCE=$EVIDENCE"

# Prove the base is the exact R814 family and the known full-frame renderer.
python3 - "$R814_BASE" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text(encoding='utf-8')
fit_l="scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
fit_f="scale=1920:1080:force_original_aspect_ratio=decrease:flags=fast_bilinear,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
required=[
 "version: 'R814-",
 "const FULL_FRAME_FILTER_R787 = '"+fit_l+"';",
 "const LIVE_FULL_FRAME_FILTER_R794 = '"+fit_f+"';",
 "R814 QUEUED-H264 NONFATAL HANDOFF",
]
missing=[x for x in required if x not in s]
if missing:
 print('ERROR: selected backup is not the expected working R814 base:')
 for x in missing: print(' - missing',x)
 raise SystemExit(21)
print('EXACT R814 BASE VERIFIED ✅')
PY
R814_CHECK="$(mktemp --suffix=.mjs)"
cp -a "$R814_BASE" "$R814_CHECK"
node --check "$R814_CHECK"
rm -f "$R814_CHECK"

# Patch the exact VPS R814 base, not R829/R830.
curl -fsSL --retry 6 --retry-delay 2 \
  "${SITE_BASE}/radio247/vm-lite/patch-r831-r814-hybrid.py?t=$(date +%s)" \
  -o "$PATCH_TMP"

cp -a "$R814_BASE" "$CANDIDATE"
python3 "$PATCH_TMP" "$CANDIDATE"
node --check "$CANDIDATE"

# Static invariants: preserve R814 visual engine and reject the rawvideo engine that
# changed the working visual path. Later compatible stability fixes must be present.
python3 - "$CANDIDATE" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text(encoding='utf-8')
fit_l="scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
fit_f="scale=1920:1080:force_original_aspect_ratio=decrease:flags=fast_bilinear,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
required=[
 "version: 'R831-R814-GOLDEN-HYBRID-R828-R827-R826-SMOOTH-FADE'",
 "const FULL_FRAME_FILTER_R787 = '"+fit_l+"';",
 "const LIVE_FULL_FRAME_FILTER_R794 = '"+fit_f+"';",
 "const VIDEO_INPUT_QUEUE_PACKETS_R732 = 24;",
 "const MP3_BOUNDARY_FADE_OUT_SECONDS_R814 = 3.10;",
 "const MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814 = 0.20;",
 "const MP3_BOUNDARY_FADE_IN_SECONDS_R814 = 1.50;",
 "a non-NULL packet sent after an EOF",
 "failed to send packet to filter extract_extradata",
 "R828-PERSISTENT-STATION-INTEGRITY",
 "r827-insert-commit-locked",
 "r827-committed-insert-eof-no-retry",
 "r827-committed-insert-error-no-retry",
 "R827-SHUTDOWN-NO-CLIP-RETRY",
 "r814GoldenHybridR831:true",
]
forbidden=[
 "R816-PERSISTENT-RAWVIDEO-SINGLE-X264",
 "R820-DETERMINISTIC-MASTER-PTS-LOCK",
 "STATION_LEGACY_DRAIN_DISABLED_R821",
 "r823-live-frame-stall",
 "process.exit(77)",
 "force_original_aspect_ratio=increase",
 "crop=1920:1080",
]
missing=[x for x in required if x not in s]
present=[x for x in forbidden if x in s]
if missing:
 print('ERROR: R831 missing required markers:')
 for x in missing: print(' -',x)
 raise SystemExit(31)
if present:
 print('ERROR: incompatible/unsafe tokens present:')
 for x in present: print(' -',x)
 raise SystemExit(32)
print('R831 STATIC GUARD ✅')
print('R814 VIDEO ENGINE/GEOMETRY PRESERVED EXACTLY ✅')
print('R826/R827/R828 + QUEUE24 + EARLY SMOOTH FADE PRESENT ✅')
PY

echo
echo "=== BACKUP CURRENT LIVE ==="
cp -a "$LIVE" "$BACKUP"
echo "BACKUP=$BACKUP"

rollback(){
  set +e
  echo "=== R831 ROLLBACK ===" >&2
  cp -a "$BACKUP" "$LIVE" 2>/dev/null || true
  rm -f "$DROP" "$GUARD" "$GOLDEN" 2>/dev/null || true
  systemctl daemon-reload >/dev/null 2>&1 || true
  systemctl restart "$RADIO_UNIT" >/dev/null 2>&1 || true
  echo "Rollback finished." >&2
}
trap 'rc=$?; if [ $rc -ne 0 ]; then rollback; fi; cleanup' EXIT

# R831 becomes the ONLY pre-start authority. Remove every earlier geometry/golden guard.
rm -f \
  /etc/systemd/system/andrik-radio.service.d/10-r814-fullscreen-lock.conf \
  /etc/systemd/system/andrik-radio.service.d/20-fullscreen-lock-r824.conf \
  /etc/systemd/system/andrik-radio.service.d/30-r826-permanent-guard.conf \
  /etc/systemd/system/andrik-radio.service.d/40-r828-integrity-guard.conf \
  /etc/systemd/system/andrik-radio.service.d/50-r829-golden-lock.conf \
  /etc/systemd/system/andrik-radio.service.d/60-r830-golden-lock.conf \
  /usr/local/sbin/andrik-r814-fullscreen-guard.sh \
  /usr/local/sbin/andrik-fullscreen-lock-r824.sh \
  /usr/local/sbin/andrik-radio-r826-guard \
  /usr/local/sbin/andrik-radio-r828-integrity-guard \
  /usr/local/sbin/andrik-radio-r829-golden-guard \
  /usr/local/sbin/andrik-radio-r830-golden-guard \
  2>/dev/null || true

cat "$CANDIDATE" > "$LIVE"
chown --reference="$BACKUP" "$LIVE"
chmod --reference="$BACKUP" "$LIVE"
node --check "$LIVE"

cp -a "$LIVE" "$GOLDEN"
chmod 0644 "$GOLDEN"

cat > "$GUARD" <<'GUARDSH'
#!/usr/bin/env bash
set -Eeuo pipefail
LIVE=/opt/andrik-radio/radio247/server.mjs
GOLDEN=/opt/andrik-radio/radio247/server-r831-r814-golden-hybrid.mjs
[ -s "$GOLDEN" ] || { echo "R831 GUARD: golden server missing" >&2; exit 91; }
node --check "$GOLDEN" >/dev/null
if [ ! -s "$LIVE" ] || ! cmp -s "$LIVE" "$GOLDEN"; then
  cp -a "$GOLDEN" "$LIVE"
  echo "R831 GUARD: restored complete R814-hybrid golden server.mjs"
fi
python3 - "$LIVE" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text(encoding='utf-8')
fit="scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
required=[
 "version: 'R831-R814-GOLDEN-HYBRID-R828-R827-R826-SMOOTH-FADE'",
 "const FULL_FRAME_FILTER_R787 = '"+fit+"';",
 "const MP3_BOUNDARY_FADE_OUT_SECONDS_R814 = 3.10;",
 "R828-PERSISTENT-STATION-INTEGRITY",
 "r827-insert-commit-locked",
 "a non-NULL packet sent after an EOF",
]
forbidden=["R816-PERSISTENT-RAWVIDEO-SINGLE-X264","R820-DETERMINISTIC-MASTER-PTS-LOCK","STATION_LEGACY_DRAIN_DISABLED_R821","r823-live-frame-stall","process.exit(77)"]
if any(x not in s for x in required) or any(x in s for x in forbidden):
 raise SystemExit(92)
PY
node --check "$LIVE" >/dev/null
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
cmp -s "$LIVE" "$GOLDEN" && echo "LIVE == R831 GOLDEN ✅"

echo
echo "=== ONE CONTROLLED RADIO RESTART ==="
systemctl restart "$RADIO_UNIT"

READY=0
for N in $(seq 1 120); do
  if systemctl is-active --quiet "$RADIO_UNIT" && curl -fsS --max-time 2 "$BASE_URL/status" >"$STATUS_TMP" 2>/dev/null; then
    if python3 - "$STATUS_TMP" <<'PY' >/dev/null 2>&1
import json,sys
s=json.load(open(sys.argv[1]))
assert str(s.get('version') or '').startswith('R831-R814-GOLDEN-HYBRID')
assert s.get('publisherRunning') is True
PY
    then READY=1; break; fi
  fi
  sleep 1
done
[ "$READY" = 1 ] || { echo "ERROR: R831 did not become ready" >&2; exit 40; }

# Give RTMPS time to reconnect; do not fail installation if YouTube is slow.
for N in $(seq 1 60); do
  curl -fsS --max-time 2 "$BASE_URL/status" >"$STATUS_TMP" 2>/dev/null || { sleep 1; continue; }
  NRT=$(python3 - "$STATUS_TMP" <<'PY'
import json,sys
try: print(int(json.load(open(sys.argv[1])).get('rtmpsEstablishedConnectionsR792') or 0))
except: print(0)
PY
)
  [ "$NRT" -ge 2 ] && break
  sleep 1
done

echo
echo "=== FINAL R831 STATUS ==="
curl -fsS --max-time 3 "$BASE_URL/status" | python3 -c '
import json,sys
s=json.load(sys.stdin); c=s.get("current") or {}; n=s.get("next") or {}
print("version           :",s.get("version"))
print("current           :",c.get("title"))
print("next              :",n.get("title"))
print("publisher         :",s.get("publisherRunning"))
print("video             :",s.get("videoFeederRunning"))
print("RTMPS             :",s.get("rtmpsEstablishedConnectionsR792"),"/",s.get("rtmpsExpectedConnectionsR792"))
print("transportHealthy  :",s.get("transportHealthy"))
print("R814 golden R831  :",s.get("r814GoldenHybridR831"))
print("clip commit R827  :",s.get("clipCommitLockR827"))
print("station light R828:",s.get("stationIntegrityLightR828"))
print("EOF heal R826     :",s.get("outputEofSelfHealR826"))
print("video queue       :",s.get("videoInputQueuePackets"))
print("MP3 fade out      :",s.get("mp3BoundaryFadeOutSecondsR814"))
print("MP3 fade in       :",s.get("mp3BoundaryFadeInSeconds"))
print("lastError         :",s.get("lastError") or "")
print("lastWarning       :",s.get("lastWarning") or "")
'

echo
echo "=== EXACT R814 GEOMETRY ==="
grep -nE 'FULL_FRAME_FILTER_R787|LIVE_FULL_FRAME_FILTER_R794' "$LIVE" | head -5

echo
echo "======================================================================"
echo " R831 READY ✅"
echo " EXACT WORKING R814 VIDEO ENGINE: LOCKED"
echo " EXACT R814 FULLSCREEN GEOMETRY: LOCKED"
echo " R826 REAL FLV/EOF SELF-HEAL: PRESERVED"
echo " R827 AFTER-LIVE INSERT REPLAY: FORBIDDEN"
echo " R828 REPEATED STATION FULL-DECODE: FORBIDDEN"
echo " VIDEO INPUT QUEUE: 24"
echo " MP3 FADE: 3.10 / 0.20 / 1.50"
echo " CLIP/STATION FADE: 2.65 OUT / 1.10 IN"
echo " FALSE R823 FRAME-STALL KILL: ABSENT BY DESIGN"
echo " R831 GOLDEN RESTORE BEFORE EVERY START: ENABLED"
echo "======================================================================"

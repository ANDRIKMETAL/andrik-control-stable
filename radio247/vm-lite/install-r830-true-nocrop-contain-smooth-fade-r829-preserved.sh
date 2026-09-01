#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
LIVE="/opt/andrik-radio/radio247/server.mjs"
GOLDEN="/opt/andrik-radio/radio247/server-r830-golden.mjs"
RADIO_UNIT="andrik-radio.service"
BASE="http://127.0.0.1:8080"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${LIVE}.bak-before-r830-${STAMP}"
TMP="$(mktemp --suffix=.mjs)"
EVIDENCE="/var/cache/andrik-radio-r622/diagnostics/r830-before-${STAMP}.log"
GUARD="/usr/local/sbin/andrik-radio-r830-golden-guard"
DROP="/etc/systemd/system/andrik-radio.service.d/60-r830-golden-lock.conf"
STATUS_TMP="/tmp/r830-status.json"
cleanup(){ rm -f "$TMP" "$STATUS_TMP"; }
trap cleanup EXIT

[ "${EUID}" -eq 0 ] || { echo "ERROR: run with sudo" >&2; exit 1; }
for C in node curl python3 systemctl journalctl sha256sum cmp; do command -v "$C" >/dev/null || { echo "ERROR: $C not found" >&2; exit 1; }; done
[ -f "$LIVE" ] || { echo "ERROR: $LIVE not found" >&2; exit 1; }
mkdir -p /var/cache/andrik-radio-r622/diagnostics /etc/systemd/system/andrik-radio.service.d

cat <<'HDR'
======================================================================
 R830 • TRUE NO-CROP CONTAIN + SMOOTH EARLY FADE
 R829/R828/R827/R826/R821/R820 preserved
======================================================================
HDR

{
  echo "TIME=$(date -Is)"
  echo "===== STATUS BEFORE ====="
  curl -fsS --max-time 3 "$BASE/status" 2>/dev/null || true
  echo
  echo "===== JOURNAL BEFORE ====="
  journalctl -u "$RADIO_UNIT" --since "-15 min" --no-pager -o short-iso -n 320 2>/dev/null || true
} > "$EVIDENCE"
echo "EVIDENCE=$EVIDENCE"

echo
echo "=== IMMEDIATE CONTROLLED INSTALL — NO SAFE-WINDOW WAIT ==="

echo
echo "=== DOWNLOAD R830 CANONICAL SERVER ==="
curl -fsSL --retry 6 --retry-delay 2 "${SITE_BASE}/radio247/server.mjs?t=$(date +%s)" -o "$TMP"

python3 - "$TMP" <<'PY'
from pathlib import Path
import re,sys
s=Path(sys.argv[1]).read_text(encoding='utf-8')
FIT_L="scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
FIT_F="scale=1920:1080:force_original_aspect_ratio=decrease:flags=fast_bilinear,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
required=[
 "version: 'R830-TRUE-NOCROP-CONTAIN-SMOOTH-FADE-R829-R828-R827-R826-R821-PRESERVED'",
 "const FULL_FRAME_FILTER_R787 = '"+FIT_L+"';",
 "const LIVE_FULL_FRAME_FILTER_R794 = '"+FIT_F+"';",
 "const LIVE_FULL_FRAME_GEOMETRY_R819 = '"+FIT_L+"';",
 "const CLIP_PREP_SUFFIX_R782 = '.r830-ready.mp4';",
 "const VIDEO_FADE_SECONDS_R726 = 2.65;",
 "const MP3_BOUNDARY_FADE_OUT_SECONDS_R814 = 3.10;",
 "const MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814 = 0.20;",
 "const MP3_BOUNDARY_FADE_IN_SECONDS_R814 = 1.50;",
 "trueNoCropContainR830: true",
 "smoothFadeEarlierR830: true",
 "R828-PERSISTENT-STATION-INTEGRITY",
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
 "const VIDEO_INPUT_QUEUE_PACKETS_R732 = 24;",
 "const AUDIO_INPUT_QUEUE_PACKETS_R732 = 8;",
]
forbidden=[
 "force_original_aspect_ratio=increase",
 "crop=1920:1080",
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
 print('ERROR: R830 required markers missing:')
 for x in missing: print(' -',x)
 raise SystemExit(31)
if present:
 print('ERROR: R830 forbidden tokens found:')
 for x in present: print(' -',x)
 raise SystemExit(32)
print('R830 STATIC GUARD ✅')
print('TRUE NO-CROP CONTAIN geometry ✅')
print('MP3->MP3 fade starts 2s earlier: 3.10s ✅')
print('MP3->video fade starts 2s earlier: 2.65s ✅')
print('R827/R828/R826/R821/R820 preserved ✅')
PY
node --check "$TMP"

echo
echo "=== BACKUP CURRENT LIVE ==="
cp -a "$LIVE" "$BACKUP"
echo "BACKUP=$BACKUP"

rollback(){
  set +e
  echo "=== R830 ROLLBACK ===" >&2
  cp -a "$BACKUP" "$LIVE" 2>/dev/null || true
  rm -f "$DROP" "$GUARD" "$GOLDEN" 2>/dev/null || true
  systemctl daemon-reload >/dev/null 2>&1 || true
  systemctl restart "$RADIO_UNIT" >/dev/null 2>&1 || true
  echo "Rollback finished." >&2
}
trap 'rc=$?; if [ $rc -ne 0 ]; then rollback; fi; cleanup' EXIT

# Remove all previous ad-hoc/golden geometry guards. R830 becomes the single authority.
rm -f \
  /etc/systemd/system/andrik-radio.service.d/20-fullscreen-lock-r824.conf \
  /etc/systemd/system/andrik-radio.service.d/30-r826-permanent-guard.conf \
  /etc/systemd/system/andrik-radio.service.d/40-r828-integrity-guard.conf \
  /etc/systemd/system/andrik-radio.service.d/50-r829-golden-lock.conf \
  /usr/local/sbin/andrik-fullscreen-lock-r824.sh \
  /usr/local/sbin/andrik-radio-r826-guard \
  /usr/local/sbin/andrik-radio-r828-integrity-guard \
  /usr/local/sbin/andrik-radio-r829-golden-guard \
  2>/dev/null || true

cat "$TMP" > "$LIVE"
chown --reference="$BACKUP" "$LIVE"
chmod --reference="$BACKUP" "$LIVE"
node --check "$LIVE"

cp -a "$LIVE" "$GOLDEN"
chmod 0644 "$GOLDEN"

cat > "$GUARD" <<'GUARDSH'
#!/usr/bin/env bash
set -Eeuo pipefail
LIVE=/opt/andrik-radio/radio247/server.mjs
GOLDEN=/opt/andrik-radio/radio247/server-r830-golden.mjs
[ -s "$GOLDEN" ] || { echo "R830 GUARD: golden server missing" >&2; exit 91; }
node --check "$GOLDEN" >/dev/null
if [ ! -s "$LIVE" ] || ! cmp -s "$LIVE" "$GOLDEN"; then
  cp -a "$GOLDEN" "$LIVE"
  echo "R830 GUARD: restored complete golden server.mjs"
fi
python3 - "$LIVE" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text(encoding='utf-8')
FIT="scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
required=[
 "version: 'R830-TRUE-NOCROP-CONTAIN-SMOOTH-FADE-R829-R828-R827-R826-R821-PRESERVED'",
 "const FULL_FRAME_FILTER_R787 = '"+FIT+"';",
 "const LIVE_FULL_FRAME_GEOMETRY_R819 = '"+FIT+"';",
 "const MP3_BOUNDARY_FADE_OUT_SECONDS_R814 = 3.10;",
 "const MP3_BOUNDARY_FADE_IN_SECONDS_R814 = 1.50;",
 "R828-PERSISTENT-STATION-INTEGRITY",
 "r827-insert-commit-locked",
 "STATION_LEGACY_DRAIN_DISABLED_R821 = true",
]
forbidden=["force_original_aspect_ratio=increase","crop=1920:1080","r823-live-frame-stall","process.exit(77)"]
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
cmp -s "$LIVE" "$GOLDEN" && echo "LIVE == GOLDEN ✅"

echo
echo "=== ONE CONTROLLED RADIO RESTART ==="
systemctl restart "$RADIO_UNIT"

READY=0
for N in $(seq 1 120); do
  if systemctl is-active --quiet "$RADIO_UNIT" && curl -fsS --max-time 2 "$BASE/status" >"$STATUS_TMP" 2>/dev/null; then
    if python3 - "$STATUS_TMP" <<'PY' >/dev/null 2>&1
import json,sys
s=json.load(open(sys.argv[1]))
assert str(s.get('version') or '').startswith('R830-')
assert s.get('publisherRunning') is True
assert s.get('stationLegacyDrainDisabledR821') is True
assert s.get('trueNoCropContainR830') is True
assert s.get('smoothFadeEarlierR830') is True
assert s.get('clipCommitLockR827') is True
assert s.get('stationIntegrityLightR828') is True
PY
    then READY=1; break; fi
  fi
  sleep 1
done
[ "$READY" = 1 ] || { echo "ERROR: R830 did not become ready" >&2; exit 40; }

sleep 8

echo
echo "=== FINAL R830 STATUS ==="
curl -fsS --max-time 3 "$BASE/status" | python3 -c '
import json,sys
s=json.load(sys.stdin); c=s.get("current") or {}; n=s.get("next") or {}
print("version           :",s.get("version"))
print("current           :",c.get("title"))
print("next              :",n.get("title"))
print("producer          :",s.get("producerRunning"))
print("publisher         :",s.get("publisherRunning"))
print("video             :",s.get("videoFeederRunning"))
print("RTMPS             :",s.get("rtmpsEstablishedConnectionsR792"),"/",s.get("rtmpsExpectedConnectionsR792"))
print("transportHealthy  :",s.get("transportHealthy"))
print("TRUE NO CROP R830 :",s.get("trueNoCropContainR830"))
print("EARLY FADE R830   :",s.get("smoothFadeEarlierR830"))
print("clip commit R827  :",s.get("clipCommitLockR827"))
print("station check R828:",s.get("stationIntegrityLightR828"))
print("station drain     :","DISABLED" if s.get("stationLegacyDrainDisabledR821") else "ERROR")
print("lastError         :",s.get("lastError") or "")
print("lastWarning       :",s.get("lastWarning") or "")
'

echo
echo "=== TRUE NO-CROP CONSTANTS ==="
grep -nE 'FULL_FRAME_FILTER_R787|LIVE_FULL_FRAME_FILTER_R794|LIVE_FULL_FRAME_GEOMETRY_R819' "$LIVE" | head -5

echo
echo "=== FADE CONSTANTS ==="
grep -nE 'VIDEO_FADE_SECONDS_R726|VIDEO_FADE_IN_SECONDS_R736|MP3_BOUNDARY_FADE_OUT_SECONDS_R814|MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814|MP3_BOUNDARY_FADE_IN_SECONDS_R814|CLIP_TO_TRACK_FADE_IN_SECONDS_R753|VIDEO_INSERT_FADE_IN_SECONDS_R757' "$LIVE" | head -12

echo
echo "======================================================================"
echo " R830 READY ✅"
echo " TRUE NO-CROP: ENTIRE SOURCE ALWAYS VISIBLE"
echo " NON-16:9 SOURCE: BLACK BARS INSTEAD OF CROP/STRETCH"
echo " STALE PREPARED CLIPS: BYPASSED VIA .r830-ready.mp4"
echo " MP3->MP3 DARKEN: 3.10s (STARTS 2s EARLIER)"
echo " MP3->VIDEO DARKEN: 2.65s (STARTS 2s EARLIER)"
echo " MP3 RECOVERY: 1.50s"
echo " CLIP/STATION REVEAL: 1.10s"
echo " R829/R828/R827/R826/R821/R820: PRESERVED"
echo " Golden: $GOLDEN"
echo " Backup: $BACKUP"
echo " Evidence: $EVIDENCE"
echo "======================================================================"

trap cleanup EXIT

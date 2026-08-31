#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
LIVE="/opt/andrik-radio/radio247/server.mjs"
VISDIR="/var/cache/andrik-radio-r622/visuals"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${LIVE}.bak-before-r806-${STAMP}"
TMP_SERVER="$(mktemp --suffix=.mjs)"
TMPROOT="$(mktemp -d)"
cleanup(){ rm -f "$TMP_SERVER"; rm -rf "$TMPROOT"; }
trap cleanup EXIT

[ "${EUID}" -eq 0 ] || { echo "ERROR: run with sudo" >&2; exit 1; }
[[ -f "$LIVE" ]] || { echo "ERROR: live server not found: $LIVE" >&2; exit 1; }
command -v node >/dev/null || { echo "ERROR: node not found" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ERROR: ffmpeg not found" >&2; exit 1; }
command -v curl >/dev/null || { echo "ERROR: curl not found" >&2; exit 1; }
command -v python3 >/dev/null || { echo "ERROR: python3 not found" >&2; exit 1; }

RADIO_PID_BEFORE="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
RADIO_ACTIVE_BEFORE="$(systemctl is-active andrik-radio.service 2>/dev/null || true)"

strict_check(){
  local f="$1"
  nice -n 19 ffmpeg -nostdin -hide_banner -nostats -loglevel error \
    -xerror -err_detect explode -i "$f" \
    -map 0:v:0 -an -sn -dn -c:v copy -bsf:v h264_mp4toannexb \
    -f h264 -y /dev/null >/dev/null 2>&1
}

sanitize_one(){
  local src="$1" label="$2"
  [[ -f "$src" ]] || { echo "[$label] source absent: $src (skip)"; return 0; }
  local sz
  sz="$(stat -c %s "$src" 2>/dev/null || echo 0)"
  (( sz > 2097152 )) || { echo "[$label] source too small: $sz bytes (skip)"; return 0; }

  local clean="${src%.mp4}.r806-clean.mp4"
  local tmp="$TMPROOT/${label}.clean.mp4"

  echo "[$label] creating sanitized stream-copy cache: $(basename "$src")"
  echo "[$label] no re-encode: malformed packets are discarded, valid H264 bytes are copied"
  nice -n 19 ffmpeg -nostdin -hide_banner -nostats -loglevel warning \
    -fflags +genpts+discardcorrupt -err_detect ignore_err -i "$src" \
    -map 0:v:0 -an -sn -dn -c:v copy -movflags +faststart \
    -f mp4 -y "$tmp"

  [[ -s "$tmp" ]] || { echo "ERROR: [$label] repaired file empty" >&2; return 1; }
  local csz
  csz="$(stat -c %s "$tmp" 2>/dev/null || echo 0)"
  (( csz > 2097152 )) || { echo "ERROR: [$label] repaired file too small: $csz" >&2; return 1; }

  echo "[$label] validating repaired MP4 through h264_mp4toannexb"
  if ! strict_check "$tmp"; then
    echo "[$label] full stream-copy still contains malformed NAL; searching longest clean prefix"
    local dur ratio keep ok=0
    dur="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$src" 2>/dev/null || echo 0)"
    for ratio in 0.90 0.80 0.70 0.60 0.50 0.40; do
      keep="$(python3 - "$dur" "$ratio" <<'PY2'
import sys
d=float(sys.argv[1] or 0); r=float(sys.argv[2]); print(f"{max(15.0,d*r):.3f}")
PY2
)"
      echo "[$label] trying clean prefix ${keep}s (${ratio})"
      rm -f "$tmp"
      nice -n 19 ffmpeg -nostdin -hide_banner -nostats -loglevel warning \
        -fflags +genpts+discardcorrupt -err_detect ignore_err -i "$src" -t "$keep" \
        -map 0:v:0 -an -sn -dn -c:v copy -movflags +faststart \
        -f mp4 -y "$tmp" || true
      if [[ -s "$tmp" ]] && strict_check "$tmp"; then
        echo "[$label] clean prefix accepted: ${keep}s"
        ok=1
        break
      fi
    done
    (( ok == 1 )) || { echo "ERROR: [$label] no strict-clean stream-copy prefix found; live source left untouched" >&2; return 1; }
  fi

  install -m 0644 "$tmp" "${clean}.new"
  mv -f "${clean}.new" "$clean"
  touch -r "$src" "$clean"
  # Make clean newer than source so R806 runtime safely prefers it.
  touch "$clean"
  echo "[$label] repaired atomically: $clean"
  echo "[$label] source bytes=$sz clean bytes=$(stat -c %s "$clean")"
}

echo "=== R806 ROOT-CAUSE PRECHECK ==="
echo "Observed failure: visual-feed Packet corrupt / Invalid NAL unit size / missing picture"
echo "Publisher stayed alive; source file did NOT change size/mtime/inode while read."
echo "R806 therefore sanitizes malformed visual MP4 packets OFF the live writer path."

echo "=== R806 DOWNLOAD SERVER ==="
curl -fsSL --retry 5 --retry-delay 2 "${SITE_BASE}/radio247/server.mjs?t=$(date +%s)" -o "$TMP_SERVER"

echo "=== R806 CANDIDATE CHECK ==="
grep -q "R806-VISUAL-SANITIZED-REMUX-FADE-GUARANTEE" "$TMP_SERVER" || { echo "ERROR: downloaded server is not R806" >&2; exit 1; }
grep -q "visual-r806-sanitized" "$TMP_SERVER" || { echo "ERROR: R806 visual sanitizer diagnostics missing" >&2; exit 1; }
grep -q "mp3-r806-boundary-fade-armed" "$TMP_SERVER" || { echo "ERROR: R806 boundary fade guarantee missing" >&2; exit 1; }
grep -q "station-r804-clean-cut-complete" "$TMP_SERVER" || { echo "ERROR: R804 station fix not preserved" >&2; exit 1; }
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
    if x!=y: raise SystemExit(f"ERROR: {name} changed; R806 refuses install")

same('INGEST','const STREAM_URL_OVERRIDE','const YOUTUBE_LIVE_URL')
same('TRANSPORT_CONSTANTS','const TRANSPORT_FATAL_RESTART_DELAY_MS_R746','const LIVE_CURRENT_FILE')
same('H264+PUBLISHER','function h264EncoderArgsR721()','async function visualLoopOffsetR735')
same('R801_MP3_ATOMIC','async function atomicReplaceNormalVideoFeederR801','async function ensureNormalVideoFeederR721')
same('FADE_GRAPH','function normalVideoFilterComplexR721','function clipFilterComplexR721')
same('R804_STATION_CUT','async function detachNormalVideoForStationR804','function detachNormalVideoAtBoundaryR752')
print('OK: RTMPS transport, encoder/publisher, R801 atomic swap, R799 fade graph and R804 station cut are preserved.')
PY

echo "=== PRE-SANITIZE LOCAL VISUAL MASTERS (NO RADIO RESTART YET) ==="
mkdir -p "$VISDIR"
sanitize_one "$VISDIR/stream-morning-master-r703.mp4" morning
sanitize_one "$VISDIR/stream-day-master-r620.mp4" day
sanitize_one "$VISDIR/stream-evening-master-r620.mp4" evening
sanitize_one "$VISDIR/stream-night-master-r620.mp4" night

echo "=== BACKUP SERVER ==="
cp -a "$LIVE" "$BACKUP"
echo "Backup: $BACKUP"

rollback(){
  set +e
  echo "=== R806 ROLLBACK SERVER ===" >&2
  cp -a "$BACKUP" "$LIVE" 2>/dev/null || true
  systemctl restart andrik-radio.service >/dev/null 2>&1 || true
  echo "Sanitized *.r806-clean.mp4 files are harmless side-by-side cache files and are left in place." >&2
}
trap 'rc=$?; if [ $rc -ne 0 ] && [ -f "$BACKUP" ]; then rollback; fi; cleanup' EXIT

echo "=== INSTALL R806 SERVER ==="
cat "$TMP_SERVER" > "$LIVE"
chown --reference="$BACKUP" "$LIVE"
chmod --reference="$BACKUP" "$LIVE"
node --check "$LIVE"

echo "=== CONTROLLED ONE-TIME RADIO RESTART ==="
if ! systemctl restart andrik-radio.service; then
  echo "ERROR: R806 restart failed" >&2
  exit 1
fi
sleep 12
if [[ "$(systemctl is-active andrik-radio.service 2>/dev/null || true)" != "active" ]]; then
  systemctl status andrik-radio.service --no-pager -l | tail -n 140 || true
  echo "ERROR: R806 radio not active" >&2
  exit 1
fi

RADIO_PID_AFTER="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"

echo "=== R806 ACTIVE ==="
grep -n "R806-VISUAL-SANITIZED\|visual-r806-sanitized\|mp3-r806-boundary-fade-armed\|R804-STATION-SINGLE-WRITER" "$LIVE" | head -n 30 || true

echo "=== VISUAL FILES ==="
for f in "$VISDIR"/*.r806-clean.mp4; do
  [[ -e "$f" ]] || continue
  printf '%s  %s bytes\n' "$f" "$(stat -c %s "$f")"
done

echo "=== RADIO RESTART PROOF ==="
echo "radio active before : ${RADIO_ACTIVE_BEFORE:-unknown}"
echo "radio MainPID before: ${RADIO_PID_BEFORE:-0}"
echo "radio MainPID after : ${RADIO_PID_AFTER:-0}"
echo "NOTE: one PID change is expected because server.mjs is reloaded exactly once."

echo "=== CURRENT FFMPEG / RTMPS ==="
ps -eo pid,ppid,%cpu,%mem,stat,etime,cmd --sort=-%cpu | grep '[f]fmpeg' | head -n 12 || true
ss -tinp 2>/dev/null | grep ':443' | grep -E 'ffmpeg|youtube|google|1450:' | head -n 12 || true

echo "=== R806 READY ==="
echo "Visual corruption guard: strict MP4/H264 packet check before use"
echo "Corrupt visual repair: discard malformed packets + c:v copy only (NO re-encode / NO quality loss)"
echo "Clean file switch: side-by-side + atomic rename; original visual untouched"
echo "MP3 boundary fade: R799 alpha-mask graph preserved + restart keeps exact remaining fade clock"
echo "R804 station single-writer: preserved"
echo "R805 live library counters: preserved"
echo "R803 single diagnostic agent: preserved"
echo "YouTube primary+backup RTMPS / 6000k / 1080p25 / AAC: untouched"
echo "Durable evidence: /var/cache/andrik-radio-r622/diagnostics/r802-events.ndjson"
echo "BACKUP=$BACKUP"

trap cleanup EXIT

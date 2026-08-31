#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
LIVE="/opt/andrik-radio/radio247/server.mjs"
AGENT="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
RADIO_UNIT="andrik-radio.service"
AGENT_UNIT="andrik-radio-web.service"
BASE="http://127.0.0.1:8080"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${LIVE}.bak-before-r817-${STAMP}"
AGENT_BACKUP="${AGENT}.bak-before-r817-${STAMP}"
TMP_SERVER="$(mktemp --suffix=.mjs)"
TMP_AGENT="$(mktemp --suffix=.mjs)"
STATUS_TMP="$(mktemp)"
EVIDENCE="/var/cache/andrik-radio-r622/diagnostics/r817-before-${STAMP}.log"

cleanup(){ rm -f "$TMP_SERVER" "$TMP_AGENT" "$STATUS_TMP"; }
trap cleanup EXIT

[ "${EUID}" -eq 0 ] || { echo "ERROR: run with sudo" >&2; exit 1; }
for C in node curl python3 systemctl; do command -v "$C" >/dev/null || { echo "ERROR: $C not found" >&2; exit 1; }; done
[ -f "$LIVE" ] || { echo "ERROR: $LIVE not found" >&2; exit 1; }
mkdir -p /var/cache/andrik-radio-r622/diagnostics

cat <<'HDR'
================================================================
 R817 • RAWVIDEO FULL-FRAME GEOMETRY GUARD
 R816 ONE PERSISTENT X264 PRESERVED
 HARD 1920x1080 + SAR 1:1 + DAR 16:9 AT MASTER ENCODER
 R814 FADE / CLIP LOCK / R803 DIAGNOSTICS PRESERVED
================================================================
HDR

RADIO_PID_BEFORE="$(systemctl show "$RADIO_UNIT" -p MainPID --value 2>/dev/null || true)"

{
  echo "TIME=$(date -Is)"
  echo "===== STATUS ====="
  curl -fsS --max-time 3 "$BASE/status" 2>/dev/null || true
  echo
  echo "===== PROCESSES ====="
  ps -eo pid,ppid,%cpu,%mem,stat,etime,cmd --sort=-%cpu | grep '[f]fmpeg' | head -n 20 || true
  echo
  echo "===== JOURNAL ====="
  journalctl -u "$RADIO_UNIT" --since "-15 min" --no-pager -o short-iso -n 300 2>/dev/null || true
  echo
  echo "===== RTMPS ====="
  ss -tnp 2>/dev/null | grep '^ESTAB' | grep ':443' | grep 'ffmpeg' || true
} > "$EVIDENCE"
echo "EVIDENCE=$EVIDENCE"

echo
echo "=== WAIT FOR SAFE ORDINARY MP3 WINDOW ==="
SAFE=0
for N in $(seq 1 120); do
  RAW="$(curl -fsS --max-time 3 "$BASE/status" 2>/dev/null || true)"
  if [ -n "$RAW" ]; then
    SAFE="$(printf '%s' "$RAW" | python3 -c 'import json,sys
try:
 s=json.load(sys.stdin)
 ok=(not bool(s.get("clipActive"))) and bool(s.get("publisherRunning")) and bool(s.get("videoFeederRunning"))
 print("1" if ok else "0")
except Exception:
 print("0")')"
    [ "$SAFE" = "1" ] && break
  fi
  [ "$N" = "1" ] && echo "Жду обычную MP3 без клипа — автоматически, максимум 10 минут..."
  sleep 5
done
[ "$SAFE" = "1" ] || { echo "ERROR: no safe ordinary MP3 window within 10 minutes" >&2; exit 1; }
echo "SAFE MP3 WINDOW ✅"

echo
echo "=== DOWNLOAD R817 CANONICAL FILES ==="
curl -fsSL --retry 6 --retry-delay 2 "${SITE_BASE}/radio247/server.mjs?t=$(date +%s)" -o "$TMP_SERVER"
curl -fsSL --retry 6 --retry-delay 2 "${SITE_BASE}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?t=$(date +%s)" -o "$TMP_AGENT"

echo
echo "=== R817 STATIC GUARD ==="
python3 - "$TMP_SERVER" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text(encoding='utf-8')
required=[
 'R817-RAWVIDEO-SAR1-DAR16X9-FULLFRAME',
 'R817-RAWVIDEO-SAR1-DAR16X9-FULLFRAME-R816-R814-PRESERVED',
 'function rawVideoOutputArgsR816()',
 'function attachVideoFrameRelayR816(',
 'function atomicReplaceNormalVideoFeederR816(',
 'streamProfileR817:',
 "'-pixel_format','yuv420p'",
 "'-video_size','1920x1080'",
 "'-framerate',String(VIDEO_FPS)",
 "'-vf','setsar=1,setdar=16/9'",
 "'-aspect','16:9'",
 'MP3_BOUNDARY_FADE_OUT_SECONDS_R814 = 1.10',
 'MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814 = 0.20',
 'MP3_BOUNDARY_FADE_IN_SECONDS_R814 = 1.15',
]
missing=[x for x in required if x not in s]
if missing:
 print('ERROR: missing R817 markers:')
 for x in missing: print(' -',x)
 raise SystemExit(31)

def block(start,end):
 a=s.find(start)
 if a<0: raise SystemExit(f'ERROR: block not found: {start}')
 b=s.find(end,a+len(start))
 if b<0: raise SystemExit(f'ERROR: end block not found: {end}')
 return s[a:b]

pub=block('function startPublisher(){','async function visualLoopOffsetR735')
for token in ["'-f','rawvideo'","'-video_size','1920x1080'","'-pixel_format','yuv420p'","'-vf','setsar=1,setdar=16/9'","'-aspect','16:9'",'...h264EncoderArgsR721()']:
 if token not in pub: raise SystemExit(f'ERROR: publisher missing {token}')
if "'-c:v','copy'" in pub or "'-f','h264','-i','pipe:4'" in pub:
 raise SystemExit('ERROR: encoded-H264 splice architecture reappeared')

feed=block('function normalVideoFeederArgsR721(', 'function spawnRawNormalVideoChildR816(')
if '...rawVideoOutputArgsR816()' not in feed:
 raise SystemExit('ERROR: normal feeder is not rawvideo')
if "'-c:v','libx264'" in feed or "'-f','h264'" in feed:
 raise SystemExit('ERROR: normal feeder still encodes H264')

print('R817 STATIC ARCHITECTURE ✅')
print('  raster : 1920x1080')
print('  SAR    : 1:1')
print('  DAR    : 16:9')
print('  feeder : raw YUV420P full frames')
print('  master : ONE persistent libx264')
PY

grep -q "streamProfileR817" "$TMP_AGENT" || { echo "ERROR: R817 web-agent profile alias missing" >&2; exit 32; }
node --check "$TMP_SERVER"
node --check "$TMP_AGENT"
echo "NODE CHECK ✅"

echo
echo "=== BACKUPS ==="
cp -a "$LIVE" "$BACKUP"
[ -f "$AGENT" ] && cp -a "$AGENT" "$AGENT_BACKUP" || true
echo "RADIO BACKUP=$BACKUP"
[ -f "$AGENT_BACKUP" ] && echo "AGENT BACKUP=$AGENT_BACKUP" || true

restore_radio(){
  set +e
  echo "=== R817 RADIO ROLLBACK ===" >&2
  cp -a "$BACKUP" "$LIVE" 2>/dev/null || true
  systemctl restart "$RADIO_UNIT" >/dev/null 2>&1 || true
  echo "Previous radio engine restored." >&2
}
restore_agent(){
  set +e
  if [ -f "$AGENT_BACKUP" ]; then
    cp -a "$AGENT_BACKUP" "$AGENT" 2>/dev/null || true
    systemctl restart "$AGENT_UNIT" >/dev/null 2>&1 || true
  fi
}

echo
echo "=== INSTALL R817 SERVER ==="
cat "$TMP_SERVER" > "$LIVE"
chown --reference="$BACKUP" "$LIVE"
chmod --reference="$BACKUP" "$LIVE"
if ! node --check "$LIVE"; then
  echo "ERROR: installed server failed syntax check" >&2
  restore_radio
  exit 40
fi

echo
echo "=== ONE CONTROLLED RADIO RESTART ==="
if ! systemctl restart "$RADIO_UNIT"; then
  echo "ERROR: systemd restart failed" >&2
  restore_radio
  exit 41
fi

echo
echo "=== WAIT FOR VALID R817 API (UP TO 120s) ==="
API_READY=0
for N in $(seq 1 120); do
  if systemctl is-active --quiet "$RADIO_UNIT" && curl -fsS --max-time 2 "$BASE/status" -o "$STATUS_TMP" 2>/dev/null; then
    if python3 - "$STATUS_TMP" <<'PY' >/dev/null 2>&1
import json,sys
s=json.load(open(sys.argv[1],encoding='utf-8'))
assert 'R817-RAWVIDEO-SAR1-DAR16X9-FULLFRAME' in str(s.get('version') or '')
assert bool(s.get('publisherRunning'))
p=s.get('streamProfileR817') or {}
g=p.get('geometry') or {}
assert g.get('raster')=='1920x1080'
assert g.get('sampleAspectRatio')=='1:1'
assert g.get('displayAspectRatio')=='16:9'
PY
    then
      API_READY=1
      echo "R817 API READY ${N}/120 ✅"
      break
    fi
  fi
  sleep 1
done

if [ "$API_READY" != "1" ]; then
  echo "ERROR: valid R817 API did not recover within 120 seconds" >&2
  systemctl status "$RADIO_UNIT" --no-pager -l | tail -n 100 >&2 || true
  journalctl -u "$RADIO_UNIT" --since "-3 min" --no-pager | tail -n 140 >&2 || true
  restore_radio
  exit 42
fi

echo
echo "=== INSTALL / RESTART R803 WEB AGENT WITH R817 PROFILE ==="
if [ -f "$AGENT" ]; then
  cat "$TMP_AGENT" > "$AGENT"
  [ -f "$AGENT_BACKUP" ] && chown --reference="$AGENT_BACKUP" "$AGENT" || true
  [ -f "$AGENT_BACKUP" ] && chmod --reference="$AGENT_BACKUP" "$AGENT" || chmod 0644 "$AGENT"
else
  install -m 0644 "$TMP_AGENT" "$AGENT"
fi
if ! node --check "$AGENT"; then
  echo "WARNING: R817 web agent syntax failed; restoring ONLY agent" >&2
  restore_agent
else
  systemctl restart "$AGENT_UNIT" || true
  sleep 4
  if ! systemctl is-active --quiet "$AGENT_UNIT"; then
    echo "WARNING: R817 web agent did not stay active; restoring ONLY agent" >&2
    restore_agent
  else
    echo "WEB AGENT ACTIVE ✅"
  fi
fi

echo
echo "=== WAIT FOR RTMPS (INFORMATIONAL, NO FALSE ROLLBACK) ==="
RTMPS_OK=0
for N in $(seq 1 60); do
  RAW="$(curl -fsS --max-time 2 "$BASE/status" 2>/dev/null || true)"
  if [ -n "$RAW" ]; then
    RTMPS="$(printf '%s' "$RAW" | python3 -c 'import json,sys
try: print(int(json.load(sys.stdin).get("rtmpsEstablishedConnectionsR792") or 0))
except Exception: print(0)')"
    if [ "${RTMPS:-0}" -ge 2 ]; then RTMPS_OK=2; echo "RTMPS 2/2 READY ${N}/60 ✅"; break
    elif [ "${RTMPS:-0}" -ge 1 ]; then RTMPS_OK=1; fi
  fi
  sleep 2
done
if [ "$RTMPS_OK" -lt 2 ]; then
  echo "WARNING: RTMPS currently ${RTMPS_OK}/2. No false rollback for transient YouTube/network delay."
fi

RADIO_PID_AFTER="$(systemctl show "$RADIO_UNIT" -p MainPID --value 2>/dev/null || true)"

echo
echo "=== FINAL R817 STATUS ==="
if curl -fsS --max-time 4 "$BASE/status" -o "$STATUS_TMP" 2>/dev/null; then
python3 - "$STATUS_TMP" <<'PY'
import json,sys
s=json.load(open(sys.argv[1],encoding='utf-8'))
p=s.get('streamProfileR817') or {}; v=p.get('video') or {}; a=p.get('audio') or {}; g=p.get('geometry') or {}
cur=s.get('current') or {}; nxt=s.get('next') or {}
print('version            :',s.get('version'))
print('current            :',cur.get('title'))
print('next               :',nxt.get('title'))
print('producerRunning    :',s.get('producerRunning'))
print('videoFeederRunning :',s.get('videoFeederRunning'))
print('publisherRunning   :',s.get('publisherRunning'))
print('transportHealthy   :',s.get('transportHealthy'))
print('RTMPS              :',s.get('rtmpsEstablishedConnectionsR792'),'/',s.get('rtmpsExpectedConnectionsR792'))
print('VIDEO              :',v.get('codec'),v.get('width'),'x',v.get('height'),v.get('fps'),'fps',v.get('bitrate'))
print('GEOMETRY           : raster',g.get('raster'),'SAR',g.get('sampleAspectRatio'),'DAR',g.get('displayAspectRatio'),'noCrop',g.get('noCrop'))
print('HANDOFF            :',s.get('videoHandoffMode'))
print('MP3 FADE           :',s.get('mp3BoundaryFadeMode'))
print('lastError          :',s.get('lastError') or '')
print('lastWarning        :',s.get('lastWarning') or '')
PY
fi

echo
echo "=== LIVE MASTER PROOF ==="
ps -eo pid,ppid,%cpu,%mem,stat,etime,cmd --sort=-%cpu | grep '[f]fmpeg' | head -n 16 || true

echo
echo "=== RTMPS SOCKETS ==="
ss -tnp 2>/dev/null | grep '^ESTAB' | grep ':443' | grep 'ffmpeg' || true

echo
echo "================================================================"
echo " R817 READY"
echo "================================================================"
echo "RADIO PID BEFORE=$RADIO_PID_BEFORE"
echo "RADIO PID AFTER =$RADIO_PID_AFTER"
echo "FIXED GEOMETRY:"
echo "  rawvideo demux : pixel_format=yuv420p video_size=1920x1080 framerate=25"
echo "  master filter  : setsar=1,setdar=16/9"
echo "  output aspect  : 16:9"
echo "ARCHITECTURE PRESERVED:"
echo "  full raw YUV420P frames -> Node frame relay -> ONE persistent libx264 -> dual RTMPS"
echo "  NO encoded-H264 feeder splicing"
echo "R814 PRESERVED:"
echo "  MP3 fade 1.10s out + 0.20s black + 1.15s in"
echo "  selected clip retry lock + counters + R803 journal"
echo "EVIDENCE=$EVIDENCE"
echo "BACKUP=$BACKUP"
echo "================================================================"

#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
LIVE="/opt/andrik-radio/radio247/server.mjs"
AGENT="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
RADIO_UNIT="andrik-radio.service"
AGENT_UNIT="andrik-radio-web.service"
BASE="http://127.0.0.1:8080"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${LIVE}.bak-before-r816-${STAMP}"
AGENT_BACKUP="${AGENT}.bak-before-r816-${STAMP}"
TMP_SERVER="$(mktemp --suffix=.mjs)"
TMP_AGENT="$(mktemp --suffix=.mjs)"
STATUS_TMP="$(mktemp)"
EVIDENCE="/var/cache/andrik-radio-r622/diagnostics/r816-before-${STAMP}.log"

cleanup(){ rm -f "$TMP_SERVER" "$TMP_AGENT" "$STATUS_TMP"; }
trap cleanup EXIT

[ "${EUID}" -eq 0 ] || { echo "ERROR: run with sudo" >&2; exit 1; }
for C in node curl python3 systemctl; do command -v "$C" >/dev/null || { echo "ERROR: $C not found" >&2; exit 1; }; done
[ -f "$LIVE" ] || { echo "ERROR: $LIVE not found" >&2; exit 1; }
mkdir -p /var/cache/andrik-radio-r622/diagnostics

cat <<'HDR'
================================================================
 R816 • PERSISTENT RAWVIDEO → ONE PERSISTENT X264 MASTER
 ROOT FIX: NO ENCODED-H264 FEEDER SPLICING
 R814 FEATURES / LONG MP3 FADE / CLIP RETRY / R803 DIAG PRESERVED
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
echo "=== DOWNLOAD R816 CANONICAL FILES ==="
curl -fsSL --retry 6 --retry-delay 2 "${SITE_BASE}/radio247/server.mjs?t=$(date +%s)" -o "$TMP_SERVER"
curl -fsSL --retry 6 --retry-delay 2 "${SITE_BASE}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?t=$(date +%s)" -o "$TMP_AGENT"

echo
echo "=== R816 ARCHITECTURE GUARD ==="
python3 - "$TMP_SERVER" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')
required=[
 'R816-PERSISTENT-RAWVIDEO-SINGLE-X264',
 'function rawVideoOutputArgsR816()',
 'function attachVideoFrameRelayR816(',
 'function atomicReplaceNormalVideoFeederR816(',
 "diagRecordR802('r816-rawvideo-promoted'",
 'streamProfileR816:',
 'R816-FULL-FRAME-ONLY-YUV420P',
 'R816-PERSISTENT-RAWVIDEO-25FPS-SINGLE-X264',
 'MP3_BOUNDARY_FADE_OUT_SECONDS_R814 = 1.10',
 'MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814 = 0.20',
 'MP3_BOUNDARY_FADE_IN_SECONDS_R814 = 1.15',
 "diagRecordR802('r814-normal-clip-retry'",
]
missing=[x for x in required if x not in s]
if missing:
 print('ERROR: missing R816 markers:')
 for x in missing: print(' -',x)
 raise SystemExit(31)

def block(start,end):
 a=s.find(start)
 if a<0: raise SystemExit(f'ERROR: block not found: {start}')
 b=s.find(end,a+len(start))
 if b<0: raise SystemExit(f'ERROR: end block not found: {end}')
 return s[a:b]

pub=block('function startPublisher(){','async function visualLoopOffsetR735')
if "'-f','rawvideo'" not in pub or "'-i','pipe:4'" not in pub:
 raise SystemExit('ERROR: publisher is not rawvideo pipe:4')
if '...h264EncoderArgsR721()' not in pub:
 raise SystemExit('ERROR: persistent master does not own x264 encoder')
if "'-c:v','copy'" in pub or "'-f','h264'" in pub:
 raise SystemExit('ERROR: live publisher still accepts/copies encoded H264')

feed=block('function normalVideoFeederArgsR721(', 'function spawnRawNormalVideoChildR816(')
if '...rawVideoOutputArgsR816()' not in feed:
 raise SystemExit('ERROR: normal feeder is not rawvideo')
if "'-c:v','libx264'" in feed or "'-f','h264'" in feed:
 raise SystemExit('ERROR: normal feeder still encodes H264')

clip=block('function clipPreparedFeederArgsR742(', 'function videoLeadForDurationR744(')
if '...rawVideoOutputArgsR816()' not in clip:
 raise SystemExit('ERROR: clip/station feeder is not rawvideo')

if "'-f','h264','-i','pipe:4'" in s:
 raise SystemExit('ERROR: encoded H264 live input pipe:4 still exists')
print('R816 STATIC ARCHITECTURE ✅')
print('  feeders: raw YUV420P only')
print('  handoff: complete raw frames')
print('  master : one persistent libx264')
print('  output : dual RTMPS preserved')
PY

grep -q "diagnosticsR816" "$TMP_AGENT" || { echo "ERROR: R816 diagnostics alias missing" >&2; exit 32; }
grep -q "streamProfileR816" "$TMP_AGENT" || { echo "ERROR: R816 stream profile alias missing" >&2; exit 33; }
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
  echo "=== R816 RADIO ROLLBACK ===" >&2
  cp -a "$BACKUP" "$LIVE" 2>/dev/null || true
  systemctl restart "$RADIO_UNIT" >/dev/null 2>&1 || true
  echo "Previous radio engine restored." >&2
}
restore_agent(){
  set +e
  if [ -f "$AGENT_BACKUP" ]; then
    cp -a "$AGENT_BACKUP" "$AGENT" 2>/dev/null || true
    systemctl restart "$AGENT_UNIT" >/dev/null 2>&1 || true
    echo "Previous web agent restored." >&2
  fi
}

echo
echo "=== INSTALL R816 SERVER ==="
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

# R815 taught us not to parse an empty curl response and not to declare failure while
# Node is merely starting. Wait up to 120 seconds for a VALID JSON R816 /status.
echo
echo "=== WAIT FOR VALID R816 API (UP TO 120s) ==="
API_READY=0
for N in $(seq 1 120); do
  if systemctl is-active --quiet "$RADIO_UNIT" && curl -fsS --max-time 2 "$BASE/status" -o "$STATUS_TMP" 2>/dev/null; then
    if python3 - "$STATUS_TMP" <<'PY' >/dev/null 2>&1
import json,sys
s=json.load(open(sys.argv[1],encoding='utf-8'))
v=str(s.get('version') or '')
assert 'R816-PERSISTENT-RAWVIDEO-SINGLE-X264' in v
assert bool(s.get('publisherRunning'))
PY
    then
      API_READY=1
      echo "R816 API READY ${N}/120 ✅"
      break
    fi
  fi
  if ! systemctl is-active --quiet "$RADIO_UNIT"; then
    echo "radio service not active at ${N}s; waiting for systemd recovery..."
  fi
  sleep 1
done

if [ "$API_READY" != "1" ]; then
  echo "ERROR: valid R816 API did not recover within 120 seconds" >&2
  systemctl status "$RADIO_UNIT" --no-pager -l | tail -n 100 >&2 || true
  journalctl -u "$RADIO_UNIT" --since "-3 min" --no-pager | tail -n 140 >&2 || true
  restore_radio
  exit 42
fi

echo
echo "=== INSTALL / RESTART R803 WEB AGENT WITH R816 ALIASES ==="
if [ -f "$AGENT" ]; then
  cat "$TMP_AGENT" > "$AGENT"
  [ -f "$AGENT_BACKUP" ] && chown --reference="$AGENT_BACKUP" "$AGENT" || true
  [ -f "$AGENT_BACKUP" ] && chmod --reference="$AGENT_BACKUP" "$AGENT" || chmod 0644 "$AGENT"
else
  install -m 0644 "$TMP_AGENT" "$AGENT"
fi
if ! node --check "$AGENT"; then
  echo "WARNING: R816 web agent syntax failed; restoring ONLY agent" >&2
  restore_agent
else
  systemctl restart "$AGENT_UNIT" || true
  sleep 4
  if ! systemctl is-active --quiet "$AGENT_UNIT"; then
    echo "WARNING: R816 web agent did not stay active; restoring ONLY agent" >&2
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
    if [ "${RTMPS:-0}" -ge 2 ]; then
      RTMPS_OK=2; echo "RTMPS 2/2 READY ${N}/60 ✅"; break
    elif [ "${RTMPS:-0}" -ge 1 ]; then
      RTMPS_OK=1
    fi
  fi
  sleep 2
done
if [ "$RTMPS_OK" -lt 2 ]; then
  echo "WARNING: RTMPS currently ${RTMPS_OK}/2 after wait. R816 is NOT rolled back for a transient network/YouTube delay."
fi

RADIO_PID_AFTER="$(systemctl show "$RADIO_UNIT" -p MainPID --value 2>/dev/null || true)"

echo
echo "=== FINAL R816 STATUS ==="
if curl -fsS --max-time 4 "$BASE/status" -o "$STATUS_TMP" 2>/dev/null; then
python3 - "$STATUS_TMP" <<'PY'
import json,sys
s=json.load(open(sys.argv[1],encoding='utf-8'))
p=s.get('streamProfileR816') or s.get('streamProfileR813') or {}
v=p.get('video') or {}; a=p.get('audio') or {}; h=p.get('handoff') or {}
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
print('VIDEO ENCODER      :',v.get('encoder'))
print('AUDIO              :',a.get('codec'),a.get('sampleRate'),'Hz',a.get('channelLayout'),a.get('bitrate'))
print('HANDOFF            :',s.get('videoHandoffMode') or h.get('mode'))
print('VIDEO RELAY        :',s.get('videoRelayMode'))
print('FULL FRAMES WRITTEN:',s.get('videoRelayFramesWritten'))
print('PARTIAL BYTES DROP :',s.get('videoRelayPartialBytesDropped'))
print('MP3 FADE           :',s.get('mp3BoundaryFadeMode'))
print('lastError          :',s.get('lastError') or '')
print('lastWarning        :',s.get('lastWarning') or '')
PY
else
  echo "WARNING: status endpoint unavailable during final display"
fi

echo
echo "=== LIVE PIPE PROOF ==="
# These process lines should show ONE master with rawvideo pipe:4 + libx264,
# while local visual feeders end in rawvideo pipe:1 and contain no libx264.
ps -eo pid,ppid,%cpu,%mem,stat,etime,cmd --sort=-%cpu | grep '[f]fmpeg' | head -n 16 || true

echo
echo "=== RTMPS SOCKETS ==="
ss -tnp 2>/dev/null | grep '^ESTAB' | grep ':443' | grep 'ffmpeg' || true

echo
echo "================================================================"
echo " R816 READY"
echo "================================================================"
echo "RADIO PID BEFORE=$RADIO_PID_BEFORE"
echo "RADIO PID AFTER =$RADIO_PID_AFTER"
echo "ARCHITECTURE:"
echo "  MP3/clip/station visuals -> RAW YUV420P full frames"
echo "  Node relay -> complete 1920x1080 frames only"
echo "  ONE persistent FFmpeg master -> ONE libx264 encoder"
echo "  ONE continuous GOP/SPS/PPS/DPB state -> FLV -> dual RTMPS"
echo "PRESERVED:"
echo "  R814 MP3 fade 1.10s out + 0.20s black + 1.15s in"
echo "  R814 selected-clip retry lock"
echo "  R809/R808/R806/R805/R804 protections and counters"
echo "  R803 diagnostic journal + stream profile"
echo "IMPORTANT: RTMPS delay never triggers a false installer rollback."
echo "EVIDENCE=$EVIDENCE"
echo "BACKUP=$BACKUP"
echo "================================================================"

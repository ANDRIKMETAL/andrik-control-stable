#!/usr/bin/env bash
set -Eeuo pipefail

B="/opt/andrik-radio/backups"
LIVE="/opt/andrik-radio/radio247/server.mjs"
ENV="/etc/andrik-radio.env"
GOLD="$B/R857-FULLSCREEN-GOLD-LATEST.tar.gz"
RESTORE="/usr/local/sbin/andrik-radio-fullscreen-gold-restore-r867"
STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="$(mktemp -d /tmp/andrik-r870-gold.XXXXXX)"
NEW="$B/.R870-GOLD-$STAMP.tmp.tar.gz"
PREV="$B/R857-FULLSCREEN-GOLD-PREV-R870-$STAMP.tar.gz"
trap 'rm -rf "$TMP"; rm -f "$NEW"' EXIT

echo '=== R870 GOLD SYNC · CURRENT WORKING 1/1 ==='

test -s "$LIVE" || { echo 'STOP: server.mjs missing'; exit 1; }
test -s "$ENV" || { echo 'STOP: env missing'; exit 1; }
test -s "$RESTORE" || { echo 'STOP: R867 GOLD restore helper missing'; exit 1; }

PID1="$(systemctl show -p MainPID --value andrik-radio.service)"
node --check "$LIVE"

STATUS="$TMP/status.json"
curl -fsS --max-time 5 http://127.0.0.1:8080/status > "$STATUS"
python3 - "$STATUS" <<'PY'
import json,sys
s=json.load(open(sys.argv[1]))
a=int(s.get('rtmpsEstablishedConnectionsR792',0) or 0)
e=int(s.get('rtmpsExpectedConnectionsR792',0) or 0)
h=s.get('transportHealthy') is True
v=bool(s.get('videoFeederRunning'))
print(f'RTMPS={a}/{e} healthy={h} video={v}')
if (a,e)!=(1,1): raise SystemExit('STOP: current radio is not RTMPS 1/1')
if not h or not v: raise SystemExit('STOP: current radio is not healthy')
PY

grep -qE '^[[:space:]]*(export[[:space:]]+)?YOUTUBE_DUAL_INGEST_R792=0[[:space:]]*$' "$ENV" || {
  echo 'STOP: env is not locked to YOUTUBE_DUAL_INGEST_R792=0'; exit 1;
}

# Verify the three viewer-proven fullscreen paths without changing the live file.
for NAME in FULL_FRAME_FILTER_R787 LIVE_FULL_FRAME_FILTER_R794 LIVE_FULL_FRAME_GEOMETRY_R819; do
  grep -Eq "const[[:space:]]+$NAME[[:space:]]*=[[:space:]]*'scale=1920:1080:flags=lanczos,setsar=1'" "$LIVE" || {
    echo "STOP: $NAME is not direct 1920x1080"; exit 1;
  }
done

SHA="$(sha256sum "$LIVE" | awk '{print $1}')"
echo "Current server SHA: $SHA"
echo 'Stream key: [not printed]'

cp -a "$LIVE" "$TMP/server.mjs"
cp -a "$ENV" "$TMP/andrik-radio.env"
cat > "$TMP/MANIFEST.txt" <<MANIFEST
ANDRIK R870 SAFE GOLD
captured=$STAMP
server_sha256=$SHA
RTMPS=1/1
YOUTUBE_DUAL_INGEST_R792=0
FULLSCREEN=DIRECT_1920x1080
TRANSPORT=HEALTHY
MANIFEST

tar -C "$TMP" -czf "$NEW" server.mjs andrik-radio.env MANIFEST.txt
chmod 600 "$NEW"

ARCHIVE_SHA="$(tar -xOf "$NEW" server.mjs | sha256sum | awk '{print $1}')"
[ "$ARCHIVE_SHA" = "$SHA" ] || { echo 'STOP: archive verification failed'; exit 1; }
tar -xOf "$NEW" andrik-radio.env | grep -qE '^[[:space:]]*(export[[:space:]]+)?YOUTUBE_DUAL_INGEST_R792=0[[:space:]]*$' || { echo 'STOP: archive lost 1/1 setting'; exit 1; }

if [ -s "$GOLD" ]; then cp -a "$GOLD" "$PREV"; chmod 600 "$PREV"; fi
mv -f "$NEW" "$GOLD"; chmod 600 "$GOLD"

# Make the existing R867 rescue helper accept exactly the server captured above.
cp -a "$RESTORE" "$B/andrik-radio-fullscreen-gold-restore-r867.before-R870-$STAMP"
python3 - "$RESTORE" "$SHA" <<'PY'
import re,sys
p,sha=sys.argv[1],sys.argv[2]
s=open(p,encoding='utf-8').read()
s2,n=re.subn(r'^EXPECTED="[0-9a-f]{64}"$',f'EXPECTED="{sha}"',s,count=1,flags=re.M)
if n!=1: raise SystemExit('STOP: restore EXPECTED line not found exactly once')
open(p,'w',encoding='utf-8').write(s2)
PY
chmod 755 "$RESTORE"
bash -n "$RESTORE"

PID2="$(systemctl show -p MainPID --value andrik-radio.service)"
[ "$PID1" = "$PID2" ] || { echo 'STOP: radio PID changed unexpectedly'; exit 1; }

echo
printf '%s\n' '✅ R870 GOLD = CURRENT WORKING 1/1' '✅ FULLSCREEN CORE SAVED' '✅ RESTORE SHA UPDATED' '✅ PREVIOUS GOLD PRESERVED' '✅ ZERO RADIO / FFMPEG RESTART'
echo "GOLD: $GOLD"
echo "PREVIOUS: $PREV"

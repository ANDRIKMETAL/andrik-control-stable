#!/usr/bin/env bash
set -Eeuo pipefail

AGENT="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
B="/opt/andrik-radio/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
SAVE="$B/andrik-radio-web-agent.before-R870-NO-AUTO-YOUTUBE-$STAMP.mjs"

echo '=== R870 CONTROL AGENT · NO AUTO YOUTUBE CREATE ==='
test -s "$AGENT" || { echo 'STOP: agent missing'; exit 1; }
mkdir -p "$B"
cp -a "$AGENT" "$SAVE"

PID1="$(systemctl show -p MainPID --value andrik-radio.service)"

python3 - "$AGENT" <<'PY'
import sys
p=sys.argv[1]
s=open(p,encoding='utf-8').read()
needle='      await maybeEnsureYoutubeLiveR721(headers,status);'
marker='// R870-NO-AUTO-YOUTUBE'
if marker in s:
    print('Guard already installed ✅')
elif needle in s:
    s=s.replace(needle,"      // R870-NO-AUTO-YOUTUBE: background broadcast creation/rebind disabled.\n      // Existing LIVE is observed only; YouTube creation is always a deliberate owner action.\n      // await maybeEnsureYoutubeLiveR721(headers,status);",1)
    open(p,'w',encoding='utf-8').write(s)
    print('Guard installed ✅')
else:
    raise SystemExit('STOP: expected youtube-ensure call not found; agent left untouched')
PY

node --check "$AGENT"
systemctl restart andrik-radio-web-agent.service
sleep 3
systemctl is-active --quiet andrik-radio-web-agent.service

PID2="$(systemctl show -p MainPID --value andrik-radio.service)"
[ "$PID1" = "$PID2" ] || { echo 'STOP: radio PID changed unexpectedly'; exit 1; }

echo '✅ CONTROL AGENT ONLINE'
echo '✅ AUTO YOUTUBE BROADCAST CREATE/REBIND DISABLED'
echo '✅ RADIO / FFMPEG UNTOUCHED'
echo "Backup: $SAVE"

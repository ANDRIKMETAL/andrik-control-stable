#!/usr/bin/env bash
set -Eeuo pipefail
BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
AGENT="$BASE/radio247/vm-lite/andrik-radio-web-agent-r650.mjs"
SERVICE=andrik-radio.service
WEB=andrik-radio-web-control.service

[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
node --check "$SERVER" >/dev/null

grep -q "R651-R649-STRETCH-R2-PICKER-1080P-CONTINUOUS-AUDIO" "$SERVER" || { echo 'СТОП: GitHub ещё не обновлён до R651'; exit 3; }
grep -q "scale=1920:1080:flags=lanczos" "$SERVER" || { echo 'СТОП: нет R649 stretch renderer'; exit 3; }
if grep -q "crop=1920:1080" "$SERVER"; then echo 'СТОП: crop всё ещё найден'; exit 3; fi

echo '[1/3] R651 renderer OK: EXACT 1920x1080 / NO CROP / NO PAD'

# Keep the already-paired web agent, but refresh its executable if present.
# IMPORTANT: no automatic visual replacement here; selected/current videos are NOT overwritten.
if [ -s "$AGENT" ]; then
  install -m 755 "$AGENT" /usr/local/sbin/andrik-radio-web
  install -m 755 "$AGENT" /usr/local/lib/andrik-radio-web-agent-r650.mjs
  systemctl restart "$WEB" >/dev/null 2>&1 || true
fi

echo '[2/3] Restart radio only — visual files left untouched'
systemctl restart "$SERVICE"
sleep 8

echo '[3/3] Status'
curl -fsS --max-time 10 http://127.0.0.1:8080/status | python3 -m json.tool
echo 'ГОТОВО ✅ R651 = R649 stretch renderer + R2 Day/Evening/Night picker. NO BOOTSTRAP.'

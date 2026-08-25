#!/usr/bin/env bash
set -Eeuo pipefail
BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
node --check "$SERVER" >/dev/null
grep -q "scale=1920:1080:flags=lanczos" "$SERVER" || { echo 'СТОП: нет R649 direct scale'; exit 3; }
if grep -A8 "const vf=\[" "$SERVER" | grep -q "crop=1920:1080"; then echo 'СТОП: crop снова появился'; exit 4; fi
# Preserve current selected/local DAY-EVENING-NIGHT videos. NO bootstrap, NO download, NO overwrite.
if [ -x "$BASE/radio247/vm-lite/andrik-ensure-qr-png-r646.sh" ]; then
  install -m 0755 "$BASE/radio247/vm-lite/andrik-ensure-qr-png-r646.sh" /usr/local/sbin/andrik-ensure-qr-png-r646
  /usr/local/sbin/andrik-ensure-qr-png-r646 || true
fi
systemctl restart andrik-radio.service
sleep 8
curl -fsS --max-time 10 http://127.0.0.1:8080/status | python3 -m json.tool
echo 'ГОТОВО ✅ R652: R649 direct 1920x1080 stretch, NO CROP, NO PAD. Existing videos preserved.'

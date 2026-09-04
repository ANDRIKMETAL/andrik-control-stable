#!/usr/bin/env bash
set -Eeuo pipefail
SELF="$(cd "$(dirname "$0")/../.." && pwd)"
LIVE="/opt/andrik-radio/radio247/server.mjs"
SRC="$SELF/radio247/server.mjs"
STAMP="$(date +%Y%m%d-%H%M%S)"
BAK="/opt/andrik-radio/backups/server.mjs.before-R854-$STAMP"

echo "=== ANDRIK R854 INSTALL ==="
mkdir -p /opt/andrik-radio/backups
cp -a "$LIVE" "$BAK"
cp -a "$SRC" "$LIVE"
cp "$LIVE" /tmp/andrik-r854-check.mjs
if ! node --check /tmp/andrik-r854-check.mjs; then
  echo "SYNTAX ERROR — ROLLBACK"
  cp -a "$BAK" "$LIVE"
  rm -f /tmp/andrik-r854-check.mjs
  exit 1
fi
rm -f /tmp/andrik-r854-check.mjs
# safety invariants
grep -q "R816-PERSISTENT-RAWVIDEO-SINGLE-X264" "$LIVE" || { cp -a "$BAK" "$LIVE"; echo "RAWVIDEO invariant missing — rollback"; exit 1; }
grep -q "MP3_BOUNDARY_FADE_OUT_SECONDS_R814 = 3.10" "$LIVE" || { cp -a "$BAK" "$LIVE"; echo "fade-out invariant missing — rollback"; exit 1; }
grep -q "MP3_BOUNDARY_FADE_IN_SECONDS_R814 = 1.50" "$LIVE" || { cp -a "$BAK" "$LIVE"; echo "fade-in invariant missing — rollback"; exit 1; }
grep -q 'const titleReload=`:reload=1`' "$LIVE" || { cp -a "$BAK" "$LIVE"; echo "R850 title invariant missing — rollback"; exit 1; }

systemctl restart andrik-radio.service
sleep 12

echo "SERVICE:"
systemctl is-active andrik-radio.service || true
echo "STATUS:"
curl -fsS --max-time 5 http://127.0.0.1:8080/status || true
echo
echo "BACKUP: $BAK"
echo "✅ R854 = R837 RAWVIDEO + R850 TITLE + MP3 FADE 3.10/0.20/1.50"

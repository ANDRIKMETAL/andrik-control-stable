#!/usr/bin/env bash
set -Eeuo pipefail
BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
AUTO_LOCAL=/usr/local/sbin/andrik-visual-auto-r658
GUARD_LOCAL=/usr/local/sbin/andrik-fullscreen-guard-r659
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://andrikmetal.com}"
TMP="$(mktemp -d /tmp/andrik-r690-fit.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
cp -a "$SERVER" "$SERVER.bak-r690-$(date +%Y%m%d-%H%M%S)"

# Use the deployed R690 source as canonical, so both master visuals and clips get the same FIT pipeline.
curl -fsSL --max-time 45 "$SITE_BASE/radio247/server.mjs?v=55.00-r690" -o "$TMP/server.mjs"
node --check "$TMP/server.mjs" >/dev/null

grep -q "force_original_aspect_ratio=decrease:flags=lanczos" "$TMP/server.mjs" || { echo 'СТОП: R690 FIT scale отсутствует в source'; exit 3; }
grep -q "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black" "$TMP/server.mjs" || { echo 'СТОП: R690 FIT pad отсутствует в source'; exit 4; }
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$TMP/server.mjs"; then echo 'СТОП: в R690 source найден старый crop/cover'; exit 5; fi
install -m 644 "$TMP/server.mjs" "$SERVER"

# Replace the old R658 scheduler in-place. Its filename stays unchanged because the live agent calls this exact path.
curl -fsSL --max-time 30 "$SITE_BASE/radio247/vm-lite/andrik-visual-auto-r658.sh?v=55.00-r690" -o "$TMP/auto.sh"
bash -n "$TMP/auto.sh"
install -m 755 "$TMP/auto.sh" "$AUTO_LOCAL"

# If the R659 ExecStartPre guard is present, update it too so it cannot restore the old direct-scale mode.
if [ -e "$GUARD_LOCAL" ] || systemctl cat "$SERVICE" 2>/dev/null | grep -q 'andrik-fullscreen-guard-r659'; then
  curl -fsSL --max-time 30 "$SITE_BASE/radio247/vm-lite/andrik-fullscreen-guard-r659.sh?v=55.00-r690" -o "$TMP/guard.sh"
  bash -n "$TMP/guard.sh"
  install -m 755 "$TMP/guard.sh" "$GUARD_LOCAL"
  "$GUARD_LOCAL" >/dev/null
fi

node --check "$SERVER" >/dev/null
systemctl restart "$SERVICE"
sleep 5
printf '%s\n' 'R690 FULL-FRAME FIT ✅'
printf '%s\n' '1920x1080 · aspect ratio preserved · crop OFF · stretch OFF'
systemctl is-active "$SERVICE"
curl -fsS --max-time 5 http://127.0.0.1:8080/status || true
echo

#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
SERVER=/opt/andrik-radio/radio247/server.mjs
SERVICE=andrik-radio.service
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
grep -q 'R720-NOCROP-RED-TITLE-SEAMLESS-EQ-LIVE-GUARD' "$SERVER" || {
  echo 'СТОП: на OVH не установлен R720. Сначала установи R720.'
  exit 3
}
# R720 already carries the permanent TRUE FIT/NO-CROP pipeline. The button must
# never rewrite server.mjs; it only removes legacy R659 overrides and restarts cleanly.
systemctl disable --now andrik-visual-auto-r659.timer >/dev/null 2>&1 || true
rm -f /etc/systemd/system/andrik-radio.service.d/20-fullscreen-guard-r659.conf
rm -f /usr/local/sbin/andrik-fullscreen-guard-r659
systemctl daemon-reload
systemctl restart "$SERVICE"
sleep 5
systemctl is-active --quiet "$SERVICE"
curl -fsS --max-time 5 http://127.0.0.1:8080/status
echo
echo '✅ R720 TRUE FULL FRAME FIT / NO CROP закреплён. Код server.mjs не переписывался.'

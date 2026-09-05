#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://andrikmetal.com}"
STAMP="$(date +%Y%m%d-%H%M%S)"
AGENT_URL="${SITE_BASE%/}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?t=$(date +%s)"
HELPER_URL="${SITE_BASE%/}/radio247/vm-lite/andrik-radio-screen-restore-r926?t=$(date +%s)"
AGENT_TARGET="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
HELPER_TARGET="/usr/local/sbin/andrik-radio-screen-restore-r926"
TMP_AGENT="$(mktemp /tmp/andrik-agent-r926.XXXXXX.mjs)"
TMP_HELPER="$(mktemp /tmp/andrik-screen-r926.XXXXXX.sh)"
trap 'rm -f "$TMP_AGENT" "$TMP_HELPER"' EXIT

echo '======================================================='
echo ' ANDRIK R926 · ARM ВОССТАНОВИТЬ ЭКРАН'
echo ' installer restarts WEB AGENT only'
echo ' radio encoder / R2 / cache / visuals untouched'
echo '======================================================='

curl -fsSL --retry 6 --retry-delay 2 "$AGENT_URL" -o "$TMP_AGENT"
curl -fsSL --retry 6 --retry-delay 2 "$HELPER_URL" -o "$TMP_HELPER"
node --check "$TMP_AGENT"
bash -n "$TMP_HELPER"
grep -Fq "AGENT_VERSION_R803='R926'" "$TMP_AGENT"
grep -Fq "action==='screen-restore'" "$TMP_AGENT"
grep -Fq 'ANDRIK R926 · ВОССТАНОВИТЬ ЭКРАН' "$TMP_HELPER"
grep -Fq 'PRE-R937G-AV-ONLY-' "$TMP_HELPER"

[ -f "$AGENT_TARGET" ] && cp -a "$AGENT_TARGET" "$AGENT_TARGET.before-R926-$STAMP"
[ -f "$HELPER_TARGET" ] && cp -a "$HELPER_TARGET" "$HELPER_TARGET.before-R926-$STAMP"
install -m 0755 "$TMP_AGENT" "$AGENT_TARGET"
install -m 0755 "$TMP_HELPER" "$HELPER_TARGET"

for old in /usr/local/lib/andrik-radio-web-agent-r721.mjs /usr/local/lib/andrik-radio-web-agent-r802.mjs; do
  if [ -f "$old" ]; then
    cp -a "$old" "$old.before-R926-$STAMP"
    install -m 0755 "$TMP_AGENT" "$old"
  fi
done

unit_exists(){ systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}' | grep -Fxq "$1"; }
unit_active(){ systemctl is-active --quiet "$1" 2>/dev/null; }
CANON=''
if unit_exists andrik-radio-web.service && unit_active andrik-radio-web.service; then CANON=andrik-radio-web.service
elif unit_exists andrik-radio-web-agent.service && unit_active andrik-radio-web-agent.service; then CANON=andrik-radio-web-agent.service
elif unit_exists andrik-radio-web.service; then CANON=andrik-radio-web.service
elif unit_exists andrik-radio-web-agent.service; then CANON=andrik-radio-web-agent.service
else echo '❌ web-agent service not found'; exit 40
fi

RADIO_PID_BEFORE="$(systemctl show -p MainPID --value andrik-radio.service 2>/dev/null || true)"
systemctl daemon-reload
systemctl restart "$CANON"
sleep 3
RADIO_PID_AFTER="$(systemctl show -p MainPID --value andrik-radio.service 2>/dev/null || true)"

echo "WEB AGENT=$CANON · $(systemctl is-active "$CANON" || true)"
echo "RADIO PID BEFORE=$RADIO_PID_BEFORE"
echo "RADIO PID AFTER =$RADIO_PID_AFTER"
[ "$RADIO_PID_BEFORE" = "$RADIO_PID_AFTER" ] || echo '⚠ radio PID changed externally; installer itself did not restart radio'
echo '✅ SCREEN RESTORE BUTTON BACKEND ARMED'
echo '✅ RADIO SERVICE NOT RESTARTED BY INSTALLER'
echo '======================================================='

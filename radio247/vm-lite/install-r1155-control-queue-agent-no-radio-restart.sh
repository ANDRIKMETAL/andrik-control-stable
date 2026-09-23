#!/usr/bin/env bash
set -Eeuo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SAFE='/root/ANDRIK-SAFE'
STAMP="$(date +%Y%m%d-%H%M%S)"
AGENT='/usr/local/lib/andrik-radio-web-agent-r803.mjs'
NEW_AGENT="$HERE/andrik-radio-web-agent-r803.mjs"
UNIT='andrik-radio-web-control.service'

echo '=========================================================='
echo ' ANDRIK CONTROL R1155 · QUEUE AGENT INSTALL'
echo ' WEB AGENT ONLY · RADIO WILL NOT RESTART'
echo '=========================================================='
[ -s "$NEW_AGENT" ] || { echo "❌ missing $NEW_AGENT"; exit 10; }
node --check "$NEW_AGENT"
grep -Fq "AGENT_VERSION_R803='R1155'" "$NEW_AGENT"
mkdir -p "$SAFE"
RADIO_PID_BEFORE="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
if [ -e "$AGENT" ]; then cp -a "$AGENT" "$SAFE/$(basename "$AGENT").PRE-R1155-$STAMP"; fi
install -o root -g root -m 0644 "$NEW_AGENT" "$AGENT"
if systemctl cat "$UNIT" >/dev/null 2>&1; then
  systemctl restart "$UNIT"
  sleep 2
  systemctl is-active --quiet "$UNIT" || { echo "❌ $UNIT failed"; exit 20; }
  echo "✅ $UNIT restarted"
else
  echo '⚠️ web-agent unit not found; file installed'
fi
RADIO_PID_AFTER="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
echo "Radio PID before: $RADIO_PID_BEFORE"
echo "Radio PID after : $RADIO_PID_AFTER"
[ -z "$RADIO_PID_BEFORE" ] || [ "$RADIO_PID_BEFORE" = "$RADIO_PID_AFTER" ] || { echo '❌ radio PID changed unexpectedly'; exit 40; }
echo '✅ RADIO NOT RESTARTED'
echo '✅ Agent R1155 queue-next protocol installed'

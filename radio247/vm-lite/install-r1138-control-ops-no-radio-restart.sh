#!/usr/bin/env bash
set -Eeuo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SAFE='/root/ANDRIK-SAFE'
STAMP="$(date +%Y%m%d-%H%M%S)"
AGENT='/usr/local/lib/andrik-radio-web-agent-r803.mjs'
GOLD='/usr/local/sbin/andrik-radio-air-restore-r925'
SCREEN='/usr/local/sbin/andrik-radio-screen-restore-r926'
NEW_AGENT="$HERE/andrik-radio-web-agent-r803.mjs"
NEW_GOLD="$HERE/andrik-radio-air-restore-r925"
NEW_SCREEN="$HERE/andrik-radio-screen-restore-r926"

echo '=========================================================='
echo ' ANDRIK CONTROL R1138 · SAFE OPS INSTALL'
echo ' WEB AGENT + SAFE RECOVERY HELPERS · NO RADIO RESTART'
echo '=========================================================='
for f in "$NEW_AGENT" "$NEW_GOLD" "$NEW_SCREEN"; do [ -s "$f" ] || { echo "❌ missing $f"; exit 10; }; done
node --check "$NEW_AGENT"
bash -n "$NEW_GOLD"; bash -n "$NEW_SCREEN"
grep -Fq "AGENT_VERSION_R803='R1138'" "$NEW_AGENT"
mkdir -p "$SAFE"
RADIO_PID_BEFORE="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
for pair in "$AGENT:$NEW_AGENT" "$GOLD:$NEW_GOLD" "$SCREEN:$NEW_SCREEN"; do
  dst="${pair%%:*}"; src="${pair#*:}"
  if [ -e "$dst" ]; then cp -a "$dst" "$SAFE/$(basename "$dst").PRE-R1138-$STAMP"; fi
  mode=0755; [ "$dst" = "$AGENT" ] && mode=0644
  install -o root -g root -m "$mode" "$src" "$dst"
done
UNIT='andrik-radio-web-control.service'
if systemctl cat "$UNIT" >/dev/null 2>&1; then
  systemctl restart "$UNIT"
  sleep 2
  echo "✅ $UNIT restarted"
else
  echo '⚠️ web-agent unit not found; files installed, agent restart must be done manually'
fi
RADIO_PID_AFTER="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
echo "Radio PID before: $RADIO_PID_BEFORE"
echo "Radio PID after : $RADIO_PID_AFTER"
[ -z "$RADIO_PID_BEFORE" ] || [ "$RADIO_PID_BEFORE" = "$RADIO_PID_AFTER" ] || { echo '❌ radio PID changed unexpectedly'; exit 40; }
echo '✅ RADIO NOT RESTARTED'
echo '✅ Agent R1138 + GOLD CORE + VIDEO FEEDER recovery installed'

#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
STAMP="$(date +%Y%m%d-%H%M%S)"
AGENT_URL="${SITE_BASE%/}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?t=$(date +%s)"
RESTORE_URL="${SITE_BASE%/}/radio247/vm-lite/andrik-radio-fullscreen-cache-restore-r908?t=$(date +%s)"
AGENT_TARGET="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
RESTORE_TARGET="/usr/local/sbin/andrik-radio-fullscreen-cache-restore-r908"
TMP_AGENT="$(mktemp /tmp/andrik-agent-r921.XXXXXX.mjs)"
TMP_RESTORE="$(mktemp /tmp/andrik-fullscreen-r921.XXXXXX.sh)"
trap 'rm -f "$TMP_AGENT" "$TMP_RESTORE"' EXIT

echo '======================================================='
echo ' ANDRIK R921 · РУБИЛЬНИК ВЕСЬ ЭКРАН'
echo ' ACTIVE VISUAL <- R906 FULLSCREEN GOLD'
echo ' installer restarts WEB AGENT only; radio is untouched'
echo '======================================================='

curl -fsSL --retry 6 --retry-delay 2 "$AGENT_URL" -o "$TMP_AGENT"
curl -fsSL --retry 6 --retry-delay 2 "$RESTORE_URL" -o "$TMP_RESTORE"

node --check "$TMP_AGENT"
bash -n "$TMP_RESTORE"
grep -Fq "action==='fullscreen-restore'" "$TMP_AGENT" || { echo 'ERROR: fullscreen-restore action missing'; exit 1; }
grep -Fq 'ANDRIK R921 · РУБИЛЬНИК ВЕСЬ ЭКРАН' "$TMP_RESTORE" || { echo 'ERROR: R921 restore script marker missing'; exit 1; }
grep -Fq 'GOLD-R906-R905-FULLSCREEN-CLIPS-SHUFFLE-*' "$TMP_RESTORE" || { echo 'ERROR: R906 GOLD source logic missing'; exit 1; }

[[ -f "$AGENT_TARGET" ]] && cp -a "$AGENT_TARGET" "$AGENT_TARGET.before-R921-$STAMP"
[[ -f "$RESTORE_TARGET" ]] && cp -a "$RESTORE_TARGET" "$RESTORE_TARGET.before-R921-$STAMP"
install -m 0755 "$TMP_AGENT" "$AGENT_TARGET"
install -m 0755 "$TMP_RESTORE" "$RESTORE_TARGET"

unit_exists(){ systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}' | grep -Fxq "$1"; }
unit_active(){ systemctl is-active --quiet "$1" 2>/dev/null; }
agentish_unit(){ local x; x="$(systemctl show -p ExecStart --value "$1" 2>/dev/null || true)"; grep -Eqi 'andrik-radio-web|andrik-radio-web-agent' <<<"$x"; }

CANON=''
if unit_exists andrik-radio-web.service && unit_active andrik-radio-web.service; then CANON=andrik-radio-web.service
elif unit_exists andrik-radio-web-agent.service && unit_active andrik-radio-web-agent.service; then CANON=andrik-radio-web-agent.service
elif unit_exists andrik-radio-web.service; then CANON=andrik-radio-web.service
elif unit_exists andrik-radio-web-agent.service; then CANON=andrik-radio-web-agent.service
else echo 'ERROR: no ANDRIK web-agent systemd service found'; exit 1
fi

for u in andrik-radio-web.service andrik-radio-web-agent.service; do
  [[ "$u" == "$CANON" ]] && continue
  if unit_exists "$u" && agentish_unit "$u"; then systemctl disable --now "$u" 2>/dev/null || true; fi
done

for old in /usr/local/lib/andrik-radio-web-agent-r721.mjs /usr/local/lib/andrik-radio-web-agent-r802.mjs; do
  if [[ -f "$old" ]]; then
    cp -a "$old" "$old.before-R921-$STAMP"
    install -m 0755 "$AGENT_TARGET" "$old"
  fi
done

RADIO_PID_BEFORE="$(systemctl show -p MainPID --value andrik-radio.service 2>/dev/null || true)"
systemctl daemon-reload
systemctl restart "$CANON"
sleep 4
RADIO_PID_AFTER="$(systemctl show -p MainPID --value andrik-radio.service 2>/dev/null || true)"

echo "Canonical agent: $CANON"
systemctl is-active "$CANON"
echo "Radio PID before: $RADIO_PID_BEFORE"
echo "Radio PID after : $RADIO_PID_AFTER"
[[ "$RADIO_PID_BEFORE" == "$RADIO_PID_AFTER" ]] || echo '⚠️ Radio PID changed externally during install; installer itself did NOT restart radio.'

echo '✅ R921 FULLSCREEN SWITCH BACKEND ACTIVE'
echo '✅ BUTTON ACTION: fullscreen-restore'
echo '✅ RESTORE SOURCE: latest R906 fullscreen GOLD / active visual only'
echo '✅ radio was NOT restarted by installer'

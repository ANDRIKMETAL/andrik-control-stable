#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://andrikmetal.com}"
STAMP="$(date +%Y%m%d-%H%M%S)"
AGENT_URL="${SITE_BASE%/}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?t=$(date +%s)"
GOLD_URL="${SITE_BASE%/}/radio247/vm-lite/andrik-radio-fullscreen-gold-restore-r867?t=$(date +%s)"
CACHE_URL="${SITE_BASE%/}/radio247/vm-lite/andrik-radio-safe-cache-clean-r867?t=$(date +%s)"
TARGET="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
GOLD_TARGET="/usr/local/sbin/andrik-radio-fullscreen-gold-restore-r867"
CACHE_TARGET="/usr/local/sbin/andrik-radio-safe-cache-clean-r867"
TMP_AGENT="$(mktemp /tmp/andrik-agent-r867.XXXXXX.mjs)"
TMP_GOLD="$(mktemp /tmp/andrik-gold-r867.XXXXXX.sh)"
TMP_CACHE="$(mktemp /tmp/andrik-cache-r867.XXXXXX.sh)"
trap 'rm -f "$TMP_AGENT" "$TMP_GOLD" "$TMP_CACHE"' EXIT

echo '================================================'
echo ' ANDRIK R867 CONTROL RESCUE'
echo ' web-agent + one-click GOLD recovery only'
echo ' andrik-radio.service / FFmpeg will NOT restart now'
echo '================================================'

curl -fsSL --retry 6 --retry-delay 2 "$AGENT_URL" -o "$TMP_AGENT"
curl -fsSL --retry 6 --retry-delay 2 "$GOLD_URL" -o "$TMP_GOLD"
curl -fsSL --retry 6 --retry-delay 2 "$CACHE_URL" -o "$TMP_CACHE"

node --check "$TMP_AGENT"
bash -n "$TMP_GOLD"
bash -n "$TMP_CACHE"
grep -Fq "AGENT_VERSION_R803='R867'" "$TMP_AGENT" || { echo 'ERROR: R867 agent marker missing'; exit 1; }
grep -Fq "action==='gold-restore'" "$TMP_AGENT" || { echo 'ERROR: gold-restore action missing'; exit 1; }
grep -Fq 'R867 FULLSCREEN GOLD RESTORE' "$TMP_GOLD" || { echo 'ERROR: GOLD script marker missing'; exit 1; }

[[ -f "$TARGET" ]] && cp -a "$TARGET" "$TARGET.before-R867-$STAMP"
[[ -f "$GOLD_TARGET" ]] && cp -a "$GOLD_TARGET" "$GOLD_TARGET.before-R867-$STAMP"
[[ -f "$CACHE_TARGET" ]] && cp -a "$CACHE_TARGET" "$CACHE_TARGET.before-R867-$STAMP"
install -m 0755 "$TMP_AGENT" "$TARGET"
install -m 0755 "$TMP_GOLD" "$GOLD_TARGET"
install -m 0755 "$TMP_CACHE" "$CACHE_TARGET"

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
  if unit_exists "$u" && agentish_unit "$u"; then
    systemctl disable --now "$u" 2>/dev/null || true
  fi
done

# Keep historical ExecStart filenames compatible with the canonical R867 code.
for old in /usr/local/lib/andrik-radio-web-agent-r721.mjs /usr/local/lib/andrik-radio-web-agent-r802.mjs; do
  if [[ -f "$old" ]]; then
    cp -a "$old" "$old.before-R867-$STAMP"
    install -m 0755 "$TARGET" "$old"
  fi
done

systemctl daemon-reload
systemctl restart "$CANON"
sleep 4

echo "Canonical agent: $CANON"
systemctl is-active "$CANON"
echo 'Agent processes:'
pgrep -af 'node .*andrik-radio-web.*daemon|node .*andrik-radio-web-agent.*daemon' || true
echo 'Radio encoder (MUST remain untouched by this install):'
systemctl is-active andrik-radio.service 2>/dev/null || true
echo "Radio MainPID: $(systemctl show -p MainPID --value andrik-radio.service 2>/dev/null || true)"
echo '✅ R867 CONTROL RESCUE AGENT ACTIVE'
echo '✅ GOLD restore button armed'
echo '✅ safe station-cache clean button armed'
echo '✅ radio was NOT restarted by installer'

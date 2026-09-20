#!/usr/bin/env bash
set -Eeuo pipefail
SITE_BASE="${ANDRIK_SITE_BASE:-https://andrikmetal.com}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BASE="${SITE_BASE%/}/radio247/vm-lite"
TA="$(mktemp /tmp/andrik-agent-r1098.XXXXXX.mjs)"
TH="$(mktemp /tmp/andrik-loudness-helper-r1098.XXXXXX)"
TS="$(mktemp /tmp/andrik-loudness-scan-r1098.XXXXXX.py)"
TU="$(mktemp /tmp/andrik-loudness-unit-r1098.XXXXXX.service)"
trap 'rm -f "$TA" "$TH" "$TS" "$TU"' EXIT

echo '=========================================================='
echo ' ANDRIK R1098 · NEW TRACK LOUDNESS BUTTON'
echo ' RADIO SERVICE WILL NOT BE RESTARTED'
echo '=========================================================='

curl -fsSL --retry 6 --retry-delay 2 "$BASE/andrik-radio-web-agent-r803.mjs?t=$(date +%s)" -o "$TA"
curl -fsSL --retry 6 --retry-delay 2 "$BASE/andrik-radio-loudness-new-r1098?t=$(date +%s)" -o "$TH"
curl -fsSL --retry 6 --retry-delay 2 "$BASE/andrik-radio-loudness-scan-r1098.py?t=$(date +%s)" -o "$TS"
curl -fsSL --retry 6 --retry-delay 2 "$BASE/andrik-loudness-r1098.service?t=$(date +%s)" -o "$TU"

node --check "$TA"
bash -n "$TH"
python3 -m py_compile "$TS"
grep -Fq "AGENT_VERSION_R803='R1098'" "$TA"
grep -Fq "loudness-new-r1098" "$TA"
grep -Fq 'TARGET_I=-14' "$TS"
grep -Fq 'CPUQuota=25%' "$TU"

install_backup(){ local src="$1" dst="$2" mode="$3"; if [ -f "$dst" ]; then cp -a "$dst" "$dst.before-R1098-$STAMP"; fi; install -m "$mode" "$src" "$dst"; }
install_backup "$TA" /usr/local/lib/andrik-radio-web-agent-r803.mjs 0755
install_backup "$TH" /usr/local/sbin/andrik-radio-loudness-new-r1098 0755
install_backup "$TS" /usr/local/lib/andrik-radio-loudness-scan-r1098.py 0755
install_backup "$TU" /etc/systemd/system/andrik-loudness-r1098.service 0644
for old in /usr/local/lib/andrik-radio-web-agent-r721.mjs /usr/local/lib/andrik-radio-web-agent-r802.mjs; do [ -f "$old" ] && install_backup "$TA" "$old" 0755 || true; done

unit_exists(){ systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}' | grep -Fxq "$1"; }
unit_active(){ systemctl is-active --quiet "$1" 2>/dev/null; }
CANON=''
if unit_exists andrik-radio-web.service && unit_active andrik-radio-web.service; then CANON=andrik-radio-web.service
elif unit_exists andrik-radio-web-agent.service && unit_active andrik-radio-web-agent.service; then CANON=andrik-radio-web-agent.service
elif unit_exists andrik-radio-web.service; then CANON=andrik-radio-web.service
elif unit_exists andrik-radio-web-agent.service; then CANON=andrik-radio-web-agent.service
else echo '❌ web-agent service not found'; exit 40; fi

RADIO_BEFORE="$(systemctl show -p MainPID --value andrik-radio.service 2>/dev/null || true)"
systemctl daemon-reload
systemctl restart "$CANON"
sleep 3
RADIO_AFTER="$(systemctl show -p MainPID --value andrik-radio.service 2>/dev/null || true)"

echo "✅ WEB AGENT=$CANON · $(systemctl is-active "$CANON" || true)"
echo "RADIO PID BEFORE=$RADIO_BEFORE"
echo "RADIO PID AFTER =$RADIO_AFTER"
[ "$RADIO_BEFORE" = "$RADIO_AFTER" ] && echo '✅ radio PID unchanged' || echo '⚠️ radio PID changed externally; installer did not restart it'
echo '✅ R1098 helper + scanner + low-priority service installed'
echo '✅ new tracks only · -14 LUFS · TP -1.5 dBTP · LRA 11'
echo '✅ andrik-radio.service NOT restarted'

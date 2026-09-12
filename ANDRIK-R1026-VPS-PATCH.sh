#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://andrikmetal.com}"
STAMP="$(date +%Y%m%d-%H%M%S)"
AGENT_URL="${SITE_BASE%/}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?t=$(date +%s)"
CLEAN_URL="${SITE_BASE%/}/radio247/vm-lite/andrik-radio-safe-cleanup-r1026?t=$(date +%s)"
TA="$(mktemp /tmp/andrik-agent-r1026.XXXXXX.mjs)"
TC="$(mktemp /tmp/andrik-clean-r1026.XXXXXX.py)"
trap 'rm -f "$TA" "$TC"' EXIT

echo '=========================================================='
echo ' ANDRIK R1026 · WEB AGENT + SAFE STALE PROCESS CLEANUP'
echo ' RADIO SERVICE WILL NOT BE RESTARTED'
echo '=========================================================='

curl -fsSL --retry 6 --retry-delay 2 "$AGENT_URL" -o "$TA"
curl -fsSL --retry 6 --retry-delay 2 "$CLEAN_URL" -o "$TC"

node --check "$TA"
python3 -m py_compile "$TC"
grep -Fq "AGENT_VERSION_R803='R1026'" "$TA"
grep -Fq "cleanup-r1026" "$TA"
grep -Fq "active-radio-cgroup-not-confirmed" "$TC"
grep -Fq "ppid'] != 1" "$TC"

install_one(){
  local src="$1" dst="$2" mode="$3"
  if [ -f "$dst" ]; then cp -a "$dst" "$dst.before-R1026-$STAMP"; fi
  install -m "$mode" "$src" "$dst"
}

install_one "$TA" /usr/local/lib/andrik-radio-web-agent-r803.mjs 0755
install_one "$TC" /usr/local/sbin/andrik-radio-safe-cleanup-r1026 0755
for old in /usr/local/lib/andrik-radio-web-agent-r721.mjs /usr/local/lib/andrik-radio-web-agent-r802.mjs; do
  [ -f "$old" ] && install_one "$TA" "$old" 0755 || true
done

unit_exists(){ systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}' | grep -Fxq "$1"; }
unit_active(){ systemctl is-active --quiet "$1" 2>/dev/null; }
CANON=''
if unit_exists andrik-radio-web.service && unit_active andrik-radio-web.service; then
  CANON=andrik-radio-web.service
elif unit_exists andrik-radio-web-agent.service && unit_active andrik-radio-web-agent.service; then
  CANON=andrik-radio-web-agent.service
elif unit_exists andrik-radio-web.service; then
  CANON=andrik-radio-web.service
elif unit_exists andrik-radio-web-agent.service; then
  CANON=andrik-radio-web-agent.service
else
  echo '❌ web-agent service not found'
  exit 40
fi

RADIO_BEFORE="$(systemctl show -p MainPID --value andrik-radio.service 2>/dev/null || true)"
systemctl restart "$CANON"
sleep 3
RADIO_AFTER="$(systemctl show -p MainPID --value andrik-radio.service 2>/dev/null || true)"

echo "✅ WEB AGENT=$CANON · $(systemctl is-active "$CANON" || true)"
echo "RADIO PID BEFORE=$RADIO_BEFORE"
echo "RADIO PID AFTER =$RADIO_AFTER"
if [ "$RADIO_BEFORE" = "$RADIO_AFTER" ]; then
  echo '✅ radio PID unchanged'
else
  echo '⚠️ radio PID changed externally; this installer did not restart it'
fi

echo '✅ R1026 safe cleanup installed'
echo '✅ only web-agent was restarted; andrik-radio.service was NOT restarted'
echo '✅ cleanup refuses to kill anything unless active radio cgroup is positively protected'

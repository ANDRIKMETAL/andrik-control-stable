#!/usr/bin/env bash
set -Eeuo pipefail
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
AGENT_URL="${SITE_BASE%/}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?t=$(date +%s)"
TARGET="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$TARGET.before-R857-quota-$STAMP"
TMP="$(mktemp /tmp/andrik-agent-r857.XXXXXX.mjs)"
trap 'rm -f "$TMP"' EXIT

echo '=== ANDRIK R857 CLOUDFLARE QUOTA SHIELD ==='
echo 'Scope: web-agent only. andrik-radio.service / FFmpeg will NOT be restarted.'

curl -fsSL --retry 6 --retry-delay 2 "$AGENT_URL" -o "$TMP"
node --check "$TMP"
grep -q 'await sleep(10000);' "$TMP" || { echo 'ERROR: quota-safe 10s poll missing'; exit 1; }
grep -q 'now-lastYoutubeEnsureAtR721<120000' "$TMP" || { echo 'ERROR: quota-safe 120s YouTube throttle missing'; exit 1; }

[[ -f "$TARGET" ]] && cp -a "$TARGET" "$BACKUP"
install -m 0755 "$TMP" "$TARGET"

unit_exists(){ systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}' | grep -Fxq "$1"; }
unit_active(){ systemctl is-active --quiet "$1" 2>/dev/null; }
agentish_unit(){
  local x
  x="$(systemctl show -p ExecStart --value "$1" 2>/dev/null || true)"
  grep -Eqi 'andrik-radio-web|andrik-radio-web-agent' <<<"$x"
}

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
    echo "Stopping duplicate historical agent: $u"
    systemctl disable --now "$u" 2>/dev/null || true
  fi
done

# Some older canonical unit files still ExecStart an R721/R802 filename.
# Keep them working, but give them the same quota-safe R803 code.
for old in /usr/local/lib/andrik-radio-web-agent-r721.mjs /usr/local/lib/andrik-radio-web-agent-r802.mjs; do
  if [[ -f "$old" ]]; then
    cp -a "$old" "$old.before-R857-quota-$STAMP"
    install -m 0755 "$TARGET" "$old"
  fi
done

systemctl daemon-reload
systemctl restart "$CANON"
sleep 3

echo "Canonical agent: $CANON"
systemctl is-active "$CANON" || true
echo 'Web-agent processes:'
pgrep -af 'node .*andrik-radio-web.*daemon|node .*andrik-radio-web-agent.*daemon' || true
echo 'Radio encoder (NOT restarted):'
systemctl is-active andrik-radio.service 2>/dev/null || true
echo "Backup: $BACKUP"
echo '✅ R857 QUOTA SHIELD ACTIVE'

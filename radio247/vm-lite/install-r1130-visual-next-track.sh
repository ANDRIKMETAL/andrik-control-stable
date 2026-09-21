#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://andrikmetal.com}"
STAMP="$(date +%Y%m%d-%H%M%S)"
SERVER_TARGET="/opt/andrik-radio/radio247/server.mjs"
AGENT_TARGET="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
BACKUP_DIR="/opt/andrik-radio/BACKUP/R1130-VISUAL-NEXT-${STAMP}"
TMP_SERVER="$(mktemp /tmp/andrik-r1130-server.XXXXXX.mjs)"
TMP_AGENT="$(mktemp /tmp/andrik-r1130-agent.XXXXXX.mjs)"
trap 'rm -f "$TMP_SERVER" "$TMP_AGENT"' EXIT

printf '%s\n' '=========================================================='
printf '%s\n' ' ANDRIK R1130B · MASTER VIDEO PATH + NEXT TRACK'
printf '%s\n' ' R1129 CPU HEADROOM PRESERVED · R1130B PATH FIX'
printf '%s\n' ' ONE RADIO RESTART'
printf '%s\n' '=========================================================='

mkdir -p "$BACKUP_DIR"

printf '\n=== 1. DOWNLOAD EXACT R1130 FILES FROM SITE ===\n'
curl -fsSL --retry 6 --retry-delay 2 "${SITE_BASE%/}/radio247/server.mjs?v=R1130B-${STAMP}" -o "$TMP_SERVER"
curl -fsSL --retry 6 --retry-delay 2 "${SITE_BASE%/}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?v=R1130B-${STAMP}" -o "$TMP_AGENT"

printf '\n=== 2. VERIFY ===\n'
node --check "$TMP_SERVER"
node --check "$TMP_AGENT"
grep -Fq "CPU_HEADROOM_PROFILE_R1129" "$TMP_SERVER"
grep -Fq "R1130-NEXT-MP3-BOUNDARY" "$TMP_SERVER"
grep -Fq "/control/visual-next" "$TMP_SERVER"
grep -Fq "action==='visual-next'" "$TMP_AGENT"
grep -Fq "R1130B_VISUAL_PATH_FIX" "$TMP_SERVER"
echo '✅ R1129 CPU profile + R1130 visual-next confirmed'

printf '\n=== 3. BACKUP CURRENT LIVE FILES ===\n'
cp -a "$SERVER_TARGET" "$BACKUP_DIR/server.mjs.before-R1130"
[ -f "$AGENT_TARGET" ] && cp -a "$AGENT_TARGET" "$BACKUP_DIR/andrik-radio-web-agent-r803.mjs.before-R1130" || true
sha256sum "$SERVER_TARGET" > "$BACKUP_DIR/server.before.sha256" || true

printf '\n=== 4. INSTALL ===\n'
install -o root -g root -m 0644 "$TMP_SERVER" "$SERVER_TARGET"
install -o root -g root -m 0755 "$TMP_AGENT" "$AGENT_TARGET"
# Keep historical mirror synchronized when it exists.
if [ -f /opt/andrik-radio/vm-lite/andrik-radio-web-agent-r803.mjs ]; then
  install -o root -g root -m 0755 "$TMP_AGENT" /opt/andrik-radio/vm-lite/andrik-radio-web-agent-r803.mjs
fi
node --check "$SERVER_TARGET"
node --check "$AGENT_TARGET"

printf '\n=== 5. FIND ACTIVE WEB AGENT UNIT ===\n'
CANON=''
for CAND in   andrik-radio-web-control.service   andrik-radio-web.service   andrik-radio-web-agent.service; do
  if systemctl cat "$CAND" >/dev/null 2>&1; then
    CANON="$CAND"
    break
  fi
done
if [ -z "$CANON" ]; then
  HIT="$(grep -RIl --include='*.service' 'andrik-radio-web-agent-r803.mjs' /etc/systemd/system /usr/lib/systemd/system /lib/systemd/system 2>/dev/null | head -n1 || true)"
  [ -n "$HIT" ] && CANON="$(basename "$HIT")"
fi
[ -n "$CANON" ] || { echo '❌ web-agent service not found'; systemctl list-unit-files --type=service --no-legend | grep -i andrik || true; exit 40; }
echo "WEB AGENT: $CANON"

printf '\n=== 6. RESTART WEB AGENT + RADIO ONCE ===\n'
systemctl restart "$CANON"
systemctl restart andrik-radio.service
sleep 8

printf '\n=== 7. VERIFY LIVE ===\n'
echo "radio     : $(systemctl is-active andrik-radio.service || true)"
echo "web agent : $(systemctl is-active "$CANON" || true)"
echo "MainPID   : $(systemctl show andrik-radio.service -p MainPID --value || true)"
echo "Restarts  : $(systemctl show andrik-radio.service -p NRestarts --value || true)"
STATUS="$(curl -fsS --max-time 5 http://127.0.0.1:8080/status || true)"
if printf '%s' "$STATUS" | grep -Fq 'visualNextTrackLastActionR1130'; then
  echo '✅ R1130 live endpoint confirmed'
else
  echo '⚠️ R1130 status marker not seen yet'
fi

printf '\n=== 8. RECENT LOG ===\n'
journalctl -u andrik-radio.service --since '-90 sec' --no-pager | tail -n 80 || true

printf '\n==========================================================\n'
echo '✅ R1130B INSTALLED'
echo '✅ R1129 CPU HEADROOM PRESERVED · R1130B PATH FIX'
echo '✅ visual source path unified with control agent'
echo '✅ button: APPLY ON NEXT NORMAL TRACK'
echo '✅ current visual feeder is untouched when button is armed'
echo "Backup: $BACKUP_DIR"
printf '%s\n' '=========================================================='

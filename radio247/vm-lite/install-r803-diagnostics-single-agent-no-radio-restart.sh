#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_AGENT="$(mktemp --suffix=.mjs)"
STAMP="$(date +%Y%m%d-%H%M%S)"
FALLBACK_TARGET="/usr/local/lib/andrik-radio-web-agent-r721.mjs"
trap 'rm -f "$TMP_AGENT"' EXIT

unit_exists(){ systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}' | grep -Fxq "$1"; }
unit_active(){ [[ "$(systemctl is-active "$1" 2>/dev/null || true)" == "active" ]]; }
exec_mjs(){
  systemctl cat "$1" 2>/dev/null | python3 -c 'import re,sys
text=sys.stdin.read()
xs=[]
for line in text.splitlines():
    if line.lstrip().startswith("ExecStart="):
        xs += re.findall(r"(/[^\s\"\x27]+\.mjs)", line)
print(xs[-1] if xs else "")'
}

RADIO_PID_BEFORE="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
RADIO_ACTIVE_BEFORE="$(systemctl is-active andrik-radio.service 2>/dev/null || true)"

echo "=== R803 DOWNLOAD AGENT ONLY ==="
curl -fsSL --retry 5 --retry-delay 2 "${SITE_BASE}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs" -o "$TMP_AGENT"
grep -q "AGENT_VERSION_R803='R803'" "$TMP_AGENT" || { echo "ERROR: downloaded agent is not R803" >&2; exit 1; }
grep -q "agent-r803-start" "$TMP_AGENT" || { echo "ERROR: R803 durable diagnostics missing" >&2; exit 1; }
grep -q "agent-incident" "$TMP_AGENT" || { echo "ERROR: R803 incident capture missing" >&2; exit 1; }
node --check "$TMP_AGENT"

echo "=== DISCOVER WEB AGENT UNITS ==="
WEB_EXISTS=0; LEGACY_EXISTS=0
unit_exists andrik-radio-web.service && WEB_EXISTS=1 || true
unit_exists andrik-radio-web-agent.service && LEGACY_EXISTS=1 || true
printf 'andrik-radio-web.service: %s\n' "$([[ $WEB_EXISTS -eq 1 ]] && echo present || echo absent)"
printf 'andrik-radio-web-agent.service: %s\n' "$([[ $LEGACY_EXISTS -eq 1 ]] && echo present || echo absent)"

CANON=""; DUP=""
if [[ $WEB_EXISTS -eq 1 ]] && unit_active andrik-radio-web.service; then
  CANON="andrik-radio-web.service"; [[ $LEGACY_EXISTS -eq 1 ]] && DUP="andrik-radio-web-agent.service"
elif [[ $LEGACY_EXISTS -eq 1 ]] && unit_active andrik-radio-web-agent.service; then
  CANON="andrik-radio-web-agent.service"; [[ $WEB_EXISTS -eq 1 ]] && DUP="andrik-radio-web.service"
elif [[ $WEB_EXISTS -eq 1 ]]; then
  CANON="andrik-radio-web.service"; [[ $LEGACY_EXISTS -eq 1 ]] && DUP="andrik-radio-web-agent.service"
elif [[ $LEGACY_EXISTS -eq 1 ]]; then
  CANON="andrik-radio-web-agent.service"
else
  echo "ERROR: no ANDRIK web-agent systemd service found" >&2; exit 1
fi

echo "Canonical agent unit: $CANON"
[[ -n "$DUP" ]] && echo "Duplicate/standby unit: $DUP"

TARGET="$(exec_mjs "$CANON" || true)"
[[ -n "$TARGET" ]] || TARGET="$FALLBACK_TARGET"
mkdir -p "$(dirname "$TARGET")"
BACKUP="${TARGET}.bak-before-r803-${STAMP}"
if [[ -f "$TARGET" ]]; then cp -a "$TARGET" "$BACKUP"; else BACKUP=""; fi

echo "Agent target: $TARGET"
[[ -n "$BACKUP" ]] && echo "Backup: $BACKUP"

DUP_WAS_ACTIVE=0
if [[ -n "$DUP" ]] && unit_active "$DUP"; then
  DUP_WAS_ACTIVE=1
  echo "=== STOP DUPLICATE AGENT ONLY: $DUP ==="
  systemctl stop "$DUP" || true
fi

echo "=== INSTALL R803 AGENT ==="
install -m 0755 "$TMP_AGENT" "$TARGET"
node --check "$TARGET"

echo "=== RESTART CANONICAL AGENT ONLY ==="
if ! systemctl restart "$CANON"; then
  echo "ERROR: canonical agent restart failed; rolling back agent file" >&2
  [[ -n "$BACKUP" ]] && cp -a "$BACKUP" "$TARGET"
  systemctl restart "$CANON" || true
  [[ $DUP_WAS_ACTIVE -eq 1 && -n "$DUP" ]] && systemctl start "$DUP" || true
  exit 1
fi
sleep 7
if ! unit_active "$CANON"; then
  echo "ERROR: R803 canonical agent is not active; rolling back" >&2
  [[ -n "$BACKUP" ]] && cp -a "$BACKUP" "$TARGET"
  systemctl restart "$CANON" || true
  [[ $DUP_WAS_ACTIVE -eq 1 && -n "$DUP" ]] && systemctl start "$DUP" || true
  systemctl status "$CANON" --no-pager -l | tail -n 100 || true
  exit 1
fi

if [[ -n "$DUP" && "$DUP" != "$CANON" ]] && unit_exists "$DUP"; then
  echo "=== SINGLE-AGENT GUARD ==="
  systemctl stop "$DUP" || true
  systemctl disable "$DUP" >/dev/null 2>&1 || true
  echo "$DUP stopped/disabled; $CANON remains canonical"
fi

echo "=== VERIFY R803 CHECK-IN ==="
VERSION=""
for _ in 1 2 3 4 5; do
  JSON="$(curl -fsS --max-time 8 https://andrikmetal.com/api/public/radio-diagnostics-r802 2>/dev/null || true)"
  VERSION="$(printf '%s' "$JSON" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("agentVersion") or "")
except Exception: print("")' 2>/dev/null || true)"
  [[ "$VERSION" == "R803" ]] && break
  sleep 4
done
printf 'Public agentVersion: %s\n' "${VERSION:-unavailable}"

RADIO_PID_AFTER="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
RADIO_ACTIVE_AFTER="$(systemctl is-active andrik-radio.service 2>/dev/null || true)"

echo "=== RADIO NON-INTERFERENCE PROOF ==="
echo "radio active before: $RADIO_ACTIVE_BEFORE"
echo "radio active after : $RADIO_ACTIVE_AFTER"
echo "radio MainPID before: $RADIO_PID_BEFORE"
echo "radio MainPID after : $RADIO_PID_AFTER"
if [[ -n "$RADIO_PID_BEFORE" && "$RADIO_PID_BEFORE" != "0" && "$RADIO_PID_AFTER" != "$RADIO_PID_BEFORE" ]]; then
  echo "WARNING: radio MainPID changed independently during install; R803 itself did not call restart/stop/start on andrik-radio.service" >&2
fi

echo "=== ACTIVE AGENT PROCESSES ==="
pgrep -af 'node.*andrik-radio-web.*daemon' || true

echo "=== R803 READY ==="
echo "Agent version: R803"
echo "Durable agent log: /var/cache/andrik-radio-r622/diagnostics/r803-agent-events.ndjson"
echo "Merged diagnostics: https://andrikmetal.com/api/public/radio-diagnostics-r803"
echo "Backward-compatible endpoint: https://andrikmetal.com/api/public/radio-diagnostics-r802"
echo "Radio/FFmpeg/RTMPS: NOT restarted by this installer"

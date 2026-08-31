#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
CANON_UNIT="andrik-radio-web.service"
DUP_UNIT="andrik-radio-web-agent.service"
CANON_TARGET="/usr/local/sbin/andrik-radio-web"
CANON_LIB="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
CANON_DROPIN_DIR="/etc/systemd/system/${CANON_UNIT}.d"
CANON_DROPIN="${CANON_DROPIN_DIR}/r803c-single-agent.conf"
DUP_DROPIN_DIR="/etc/systemd/system/${DUP_UNIT}.d"
DUP_DROPIN="${DUP_DROPIN_DIR}/r803c-duplicate-disabled.conf"
DUP_ALLOW_MARKER="/run/andrik-radio-r650-duplicate-allowed"
TMP_AGENT="$(mktemp --suffix=.mjs)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${CANON_TARGET}.bak-before-r803c-${STAMP}"
trap 'rm -f "$TMP_AGENT"' EXIT

[ "${EUID}" -eq 0 ] || { echo "ERROR: run with sudo" >&2; exit 1; }
command -v node >/dev/null || { echo "ERROR: node not found" >&2; exit 1; }
command -v curl >/dev/null || { echo "ERROR: curl not found" >&2; exit 1; }

unit_load_state(){ systemctl show "$1" -p LoadState --value 2>/dev/null || true; }
unit_active(){ [[ "$(systemctl is-active "$1" 2>/dev/null || true)" == "active" ]]; }

[[ "$(unit_load_state "$CANON_UNIT")" == "loaded" ]] || { echo "ERROR: $CANON_UNIT not found" >&2; exit 1; }
[[ "$(unit_load_state "$DUP_UNIT")" == "loaded" ]] || { echo "ERROR: $DUP_UNIT not found" >&2; exit 1; }

RADIO_PID_BEFORE="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
RADIO_ACTIVE_BEFORE="$(systemctl is-active andrik-radio.service 2>/dev/null || true)"
CANON_ACTIVE_BEFORE="$(systemctl is-active "$CANON_UNIT" 2>/dev/null || true)"
DUP_ACTIVE_BEFORE="$(systemctl is-active "$DUP_UNIT" 2>/dev/null || true)"
DUP_ENABLED_BEFORE="$(systemctl is-enabled "$DUP_UNIT" 2>/dev/null || true)"

EXEC_CANON="$(systemctl show "$CANON_UNIT" -p ExecStart --value 2>/dev/null || true)"
EXEC_DUP="$(systemctl show "$DUP_UNIT" -p ExecStart --value 2>/dev/null || true)"

printf '%s\n' "$EXEC_CANON" | grep -Fq "$CANON_TARGET" || {
  echo "ERROR: canonical unit does not use $CANON_TARGET" >&2
  echo "$EXEC_CANON" >&2
  exit 1
}
printf '%s\n' "$EXEC_DUP" | grep -Fq 'andrik-radio-web-agent-r650.mjs' || {
  echo "ERROR: duplicate unit is not the expected R650 agent" >&2
  echo "$EXEC_DUP" >&2
  exit 1
}

echo "=== R803C CURRENT TOPOLOGY ==="
echo "canonical: $CANON_UNIT · $CANON_ACTIVE_BEFORE · $CANON_TARGET"
echo "duplicate: $DUP_UNIT · $DUP_ACTIVE_BEFORE · enabled=$DUP_ENABLED_BEFORE · R650"
echo "radio    : $RADIO_ACTIVE_BEFORE · MainPID=$RADIO_PID_BEFORE"

echo "=== DOWNLOAD R803 DIAGNOSTIC AGENT ==="
curl -fsSL --retry 5 --retry-delay 2 \
  "${SITE_BASE}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?t=$(date +%s)" \
  -o "$TMP_AGENT"
grep -q "AGENT_VERSION_R803='R803'" "$TMP_AGENT" || { echo "ERROR: downloaded agent is not R803" >&2; exit 1; }
grep -q "agent-r803-start" "$TMP_AGENT" || { echo "ERROR: durable diagnostics missing" >&2; exit 1; }
grep -q "agent-incident" "$TMP_AGENT" || { echo "ERROR: incident diagnostics missing" >&2; exit 1; }
node --check "$TMP_AGENT"

[[ -f "$CANON_TARGET" ]] || { echo "ERROR: $CANON_TARGET missing" >&2; exit 1; }
cp -a "$CANON_TARGET" "$BACKUP"
echo "Backup: $BACKUP"

rollback(){
  set +e
  echo "=== R803C ROLLBACK WEB AGENTS ONLY ===" >&2
  rm -f "$CANON_DROPIN" "$DUP_DROPIN"
  cp -a "$BACKUP" "$CANON_TARGET" 2>/dev/null || true
  systemctl daemon-reload
  if [[ "$DUP_ENABLED_BEFORE" == "enabled" ]]; then systemctl enable "$DUP_UNIT" >/dev/null 2>&1 || true; fi
  if [[ "$DUP_ACTIVE_BEFORE" == "active" ]]; then systemctl start "$DUP_UNIT" >/dev/null 2>&1 || true; fi
  systemctl restart "$CANON_UNIT" >/dev/null 2>&1 || true
  echo "Radio service was not touched by rollback." >&2
}
trap 'rc=$?; if [ $rc -ne 0 ]; then rollback; fi; rm -f "$TMP_AGENT"' EXIT

# 1) Upgrade the long-lived canonical R721 service in-place to R803.
echo "=== UPGRADE CANONICAL R721 -> R803 ==="
install -m 0755 "$TMP_AGENT" "$CANON_TARGET"
install -m 0755 "$TMP_AGENT" "$CANON_LIB"
node --check "$CANON_TARGET"
mkdir -p "$CANON_DROPIN_DIR"
cat > "$CANON_DROPIN" <<EOF
[Service]
Environment=SYSTEMD_UNIT=$CANON_UNIT
EOF

# 2) Make the historical R650 unit impossible to resurrect accidentally, without deleting it.
#    This is reversible: remove the drop-in and daemon-reload.
echo "=== DISABLE DUPLICATE R650 AGENT ==="
mkdir -p "$DUP_DROPIN_DIR"
rm -f "$DUP_ALLOW_MARKER"
cat > "$DUP_DROPIN" <<EOF
[Unit]
ConditionPathExists=$DUP_ALLOW_MARKER
EOF
systemctl disable "$DUP_UNIT" >/dev/null 2>&1 || true
systemctl stop "$DUP_UNIT" >/dev/null 2>&1 || true

systemctl daemon-reload

# Restart ONLY the canonical web agent. Never touch andrik-radio.service.
echo "=== RESTART CANONICAL WEB AGENT ONLY ==="
systemctl restart "$CANON_UNIT"
sleep 7
unit_active "$CANON_UNIT" || {
  systemctl status "$CANON_UNIT" --no-pager -l | tail -n 100 || true
  echo "ERROR: canonical R803 agent did not start" >&2
  exit 1
}

# Ensure duplicate stayed down after daemon reload / canonical restart.
systemctl stop "$DUP_UNIT" >/dev/null 2>&1 || true
sleep 2
if unit_active "$DUP_UNIT"; then
  echo "ERROR: duplicate R650 agent is still active" >&2
  exit 1
fi

# Local proof that the canonical target is R803 and sees the radio.
echo "=== LOCAL R803 STATUS ==="
LOCAL_STATUS="$($CANON_TARGET status 2>&1 || true)"
printf '%s\n' "$LOCAL_STATUS" | head -n 120
printf '%s\n' "$LOCAL_STATUS" | grep -q "diagnosticsR803" || {
  echo "ERROR: canonical agent status does not expose diagnosticsR803" >&2
  exit 1
}
printf '%s\n' "$LOCAL_STATUS" | grep -q "version: 'R803'\|version: \"R803\"" || {
  echo "ERROR: canonical agent status does not identify R803 diagnostics" >&2
  exit 1
}

CANON_PID="$(systemctl show "$CANON_UNIT" -p MainPID --value 2>/dev/null || true)"
DUP_PID="$(systemctl show "$DUP_UNIT" -p MainPID --value 2>/dev/null || true)"
RADIO_PID_AFTER="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
RADIO_ACTIVE_AFTER="$(systemctl is-active andrik-radio.service 2>/dev/null || true)"

echo "=== SINGLE AGENT PROOF ==="
echo "canonical $CANON_UNIT: $(systemctl is-active "$CANON_UNIT" 2>/dev/null || true) · PID=${CANON_PID:-0}"
echo "duplicate $DUP_UNIT: $(systemctl is-active "$DUP_UNIT" 2>/dev/null || true) · PID=${DUP_PID:-0} · enabled=$(systemctl is-enabled "$DUP_UNIT" 2>/dev/null || true)"
echo
pgrep -af 'andrik-radio-web.*daemon|andrik-radio-web-agent.*daemon' || true

[[ -n "$CANON_PID" && "$CANON_PID" != "0" ]] || { echo "ERROR: canonical web agent has no MainPID" >&2; exit 1; }
[[ -z "$DUP_PID" || "$DUP_PID" == "0" ]] || { echo "ERROR: duplicate web agent still has MainPID=$DUP_PID" >&2; exit 1; }

echo "=== RADIO NON-INTERFERENCE PROOF ==="
echo "radio active before : $RADIO_ACTIVE_BEFORE"
echo "radio active after  : $RADIO_ACTIVE_AFTER"
echo "radio MainPID before: $RADIO_PID_BEFORE"
echo "radio MainPID after : $RADIO_PID_AFTER"
[[ "$RADIO_ACTIVE_AFTER" == "active" ]] || { echo "ERROR: radio is not active (installer never touched it)" >&2; exit 1; }
if [[ -n "$RADIO_PID_BEFORE" && "$RADIO_PID_BEFORE" != "0" && "$RADIO_PID_AFTER" != "$RADIO_PID_BEFORE" ]]; then
  echo "WARNING: radio MainPID changed independently; R803C never calls restart/stop/start on andrik-radio.service" >&2
fi

# Public endpoint may be protected from VPS-originated curl by Cloudflare, so this is informational only.
echo "=== PUBLIC DIAGNOSTICS (INFORMATIONAL) ==="
HTTP="$(curl -sS -o /tmp/r803c-public.$$ -w '%{http_code}' --max-time 8 https://andrikmetal.com/api/public/radio-diagnostics-r803 2>/dev/null || true)"
echo "HTTP ${HTTP:-unavailable}"
if [[ "$HTTP" == "200" ]]; then head -c 2200 /tmp/r803c-public.$$; echo; fi
rm -f /tmp/r803c-public.$$

# Success: do not run rollback trap.
trap 'rm -f "$TMP_AGENT"' EXIT

echo "=== R803C READY ==="
echo "ONE agent: $CANON_UNIT -> R803"
echo "R650 duplicate: stopped + disabled + Condition-blocked"
echo "Durable log: /var/cache/andrik-radio-r622/diagnostics/r803-agent-events.ndjson"
echo "Public diagnostics: https://andrikmetal.com/api/public/radio-diagnostics-r803"
echo "Radio / FFmpeg / RTMPS: NOT restarted"

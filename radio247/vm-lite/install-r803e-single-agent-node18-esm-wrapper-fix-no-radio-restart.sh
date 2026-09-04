#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
CANON_UNIT="andrik-radio-web.service"
DUP_UNIT="andrik-radio-web-agent.service"
CANON_WRAPPER="/usr/local/sbin/andrik-radio-web"
CANON_LIB="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
CANON_DROPIN_DIR="/etc/systemd/system/${CANON_UNIT}.d"
CANON_DROPIN="${CANON_DROPIN_DIR}/r803e-single-agent.conf"
DUP_DROPIN_DIR="/etc/systemd/system/${DUP_UNIT}.d"
DUP_DROPIN="${DUP_DROPIN_DIR}/r803e-duplicate-disabled.conf"
DUP_ALLOW_MARKER="/run/andrik-radio-r650-duplicate-allowed"
TMP_AGENT="$(mktemp --suffix=.mjs)"
TMP_WRAPPER="$(mktemp)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_WRAPPER="${CANON_WRAPPER}.bak-before-r803e-${STAMP}"
BACKUP_LIB="${CANON_LIB}.bak-before-r803e-${STAMP}"

cleanup(){ rm -f "$TMP_AGENT" "$TMP_WRAPPER"; }
trap cleanup EXIT

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

printf '%s\n' "$EXEC_CANON" | grep -Fq "$CANON_WRAPPER" || {
  echo "ERROR: canonical unit does not use $CANON_WRAPPER" >&2
  echo "$EXEC_CANON" >&2
  exit 1
}
printf '%s\n' "$EXEC_DUP" | grep -Fq 'andrik-radio-web-agent-r650.mjs' || {
  echo "ERROR: duplicate unit is not the expected R650 agent" >&2
  echo "$EXEC_DUP" >&2
  exit 1
}

cat <<INFO
=== R803E CURRENT TOPOLOGY ===
canonical: $CANON_UNIT · $CANON_ACTIVE_BEFORE · $CANON_WRAPPER
duplicate: $DUP_UNIT · $DUP_ACTIVE_BEFORE · enabled=$DUP_ENABLED_BEFORE · R650
radio    : $RADIO_ACTIVE_BEFORE · MainPID=$RADIO_PID_BEFORE
INFO

echo "=== DOWNLOAD R803 DIAGNOSTIC AGENT ==="
curl -fsSL --retry 5 --retry-delay 2 \
  "${SITE_BASE}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?t=$(date +%s)" \
  -o "$TMP_AGENT"
grep -q "AGENT_VERSION_R803='R803'" "$TMP_AGENT" || { echo "ERROR: downloaded agent is not R803" >&2; exit 1; }
grep -q "agent-r803-start" "$TMP_AGENT" || { echo "ERROR: durable diagnostics missing" >&2; exit 1; }
grep -q "agent-incident" "$TMP_AGENT" || { echo "ERROR: incident diagnostics missing" >&2; exit 1; }
node --check "$TMP_AGENT"

cat > "$TMP_WRAPPER" <<'WRAP'
#!/usr/bin/env bash
set -Eeuo pipefail
exec /usr/bin/node /usr/local/lib/andrik-radio-web-agent-r803.mjs "$@"
WRAP
bash -n "$TMP_WRAPPER"

[[ -f "$CANON_WRAPPER" ]] || { echo "ERROR: $CANON_WRAPPER missing" >&2; exit 1; }
cp -a "$CANON_WRAPPER" "$BACKUP_WRAPPER"
if [[ -f "$CANON_LIB" ]]; then cp -a "$CANON_LIB" "$BACKUP_LIB"; fi

echo "Backup wrapper: $BACKUP_WRAPPER"
[[ -f "$BACKUP_LIB" ]] && echo "Backup module : $BACKUP_LIB" || true

rollback(){
  set +e
  echo "=== R803E ROLLBACK WEB AGENTS ONLY ===" >&2
  rm -f "$CANON_DROPIN" "$DUP_DROPIN"
  cp -a "$BACKUP_WRAPPER" "$CANON_WRAPPER" 2>/dev/null || true
  if [[ -f "$BACKUP_LIB" ]]; then cp -a "$BACKUP_LIB" "$CANON_LIB" 2>/dev/null || true; fi
  systemctl daemon-reload
  if [[ "$DUP_ENABLED_BEFORE" == "enabled" ]]; then systemctl enable "$DUP_UNIT" >/dev/null 2>&1 || true; fi
  if [[ "$DUP_ACTIVE_BEFORE" == "active" ]]; then systemctl start "$DUP_UNIT" >/dev/null 2>&1 || true; fi
  systemctl restart "$CANON_UNIT" >/dev/null 2>&1 || true
  echo "Radio service was NOT touched by rollback." >&2
}
trap 'rc=$?; if [ $rc -ne 0 ]; then rollback; fi; cleanup' EXIT

# Install the real ES module with .mjs extension, then keep the historic ExecStart
# path as a tiny bash wrapper. This is required on Node 18: executing ESM source
# from an extensionless file makes Node treat it as CommonJS.
echo "=== INSTALL R803 AS REAL .MJS + STABLE WRAPPER ==="
install -m 0644 "$TMP_AGENT" "$CANON_LIB"
install -m 0755 "$TMP_WRAPPER" "$CANON_WRAPPER"
node --check "$CANON_LIB"
bash -n "$CANON_WRAPPER"
grep -Fq 'exec /usr/bin/node /usr/local/lib/andrik-radio-web-agent-r803.mjs "$@"' "$CANON_WRAPPER" || {
  echo "ERROR: wrapper verification failed" >&2
  exit 1
}

mkdir -p "$CANON_DROPIN_DIR"
cat > "$CANON_DROPIN" <<EOF2
[Service]
Environment=SYSTEMD_UNIT=$CANON_UNIT
EOF2

# Stop the historical R650 duplicate and make accidental resurrection reversible
# but impossible without an explicit marker.
echo "=== DISABLE DUPLICATE R650 AGENT ==="
mkdir -p "$DUP_DROPIN_DIR"
rm -f "$DUP_ALLOW_MARKER"
cat > "$DUP_DROPIN" <<EOF2
[Unit]
ConditionPathExists=$DUP_ALLOW_MARKER
EOF2
systemctl disable "$DUP_UNIT" >/dev/null 2>&1 || true
systemctl stop "$DUP_UNIT" >/dev/null 2>&1 || true
systemctl daemon-reload

# Restart ONLY the web diagnostic agent. Never restart/stop/start radio.
echo "=== RESTART CANONICAL WEB AGENT ONLY ==="
systemctl restart "$CANON_UNIT"
sleep 7
unit_active "$CANON_UNIT" || {
  systemctl status "$CANON_UNIT" --no-pager -l | tail -n 120 || true
  echo "ERROR: canonical R803 agent did not start" >&2
  exit 1
}

systemctl stop "$DUP_UNIT" >/dev/null 2>&1 || true
sleep 2
if unit_active "$DUP_UNIT"; then
  echo "ERROR: duplicate R650 agent is still active" >&2
  exit 1
fi

echo "=== LOCAL R803 STATUS ==="
LOCAL_STATUS="$($CANON_WRAPPER status 2>&1 || true)"
printf '%s\n' "$LOCAL_STATUS" | head -n 160
printf '%s\n' "$LOCAL_STATUS" | grep -q "diagnosticsR803" || {
  echo "ERROR: canonical agent status does not expose diagnosticsR803" >&2
  exit 1
}
printf '%s\n' "$LOCAL_STATUS" | grep -Eq "version: ['\"]R803['\"]|\"version\"[[:space:]]*:[[:space:]]*\"R803\"" || {
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
  echo "ERROR: radio MainPID changed unexpectedly; R803E never calls restart/stop/start on andrik-radio.service" >&2
  exit 1
fi

echo "=== PUBLIC DIAGNOSTICS (INFORMATIONAL) ==="
PUB_TMP="$(mktemp)"
HTTP="$(curl -sS -o "$PUB_TMP" -w '%{http_code}' --max-time 8 https://andrikmetal.com/api/public/radio-diagnostics-r803 2>/dev/null || true)"
echo "HTTP ${HTTP:-unavailable}"
if [[ "$HTTP" == "200" ]]; then head -c 2400 "$PUB_TMP"; echo; fi
rm -f "$PUB_TMP"

trap cleanup EXIT

echo "=== R803E READY ==="
echo "ONE agent: $CANON_UNIT -> bash wrapper -> Node 18 -> R803 .mjs"
echo "R650 duplicate: stopped + disabled + Condition-blocked"
echo "Durable log: /var/cache/andrik-radio-r622/diagnostics/r803-agent-events.ndjson"
echo "Public diagnostics: https://andrikmetal.com/api/public/radio-diagnostics-r803"
echo "Radio / FFmpeg / RTMPS: NOT restarted"

#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_AGENT="$(mktemp --suffix=.mjs)"
STAMP="$(date +%Y%m%d-%H%M%S)"
trap 'rm -f "$TMP_AGENT"' EXIT

unit_exists(){ systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}' | grep -Fxq "$1"; }
unit_active(){ [[ "$(systemctl is-active "$1" 2>/dev/null || true)" == "active" ]]; }

RADIO_PID_BEFORE="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
RADIO_ACTIVE_BEFORE="$(systemctl is-active andrik-radio.service 2>/dev/null || true)"

echo "=== R803B DOWNLOAD AGENT ONLY ==="
curl -fsSL --retry 5 --retry-delay 2 "${SITE_BASE}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?t=$(date +%s)" -o "$TMP_AGENT"
grep -q "AGENT_VERSION_R803='R803'" "$TMP_AGENT" || { echo "ERROR: downloaded agent is not R803" >&2; exit 1; }
grep -q "agent-r803-start" "$TMP_AGENT" || { echo "ERROR: R803 durable diagnostics missing" >&2; exit 1; }
grep -q "agent-incident" "$TMP_AGENT" || { echo "ERROR: R803 incident capture missing" >&2; exit 1; }
node --check "$TMP_AGENT"

echo "=== DISCOVER ACTUAL WEB CONTROL UNIT ==="
CANDIDATES=(
  andrik-radio-web-control.service
  andrik-radio-web.service
  andrik-radio-web-agent.service
)
CANON=""
for u in "${CANDIDATES[@]}"; do
  if unit_exists "$u" && unit_active "$u"; then CANON="$u"; break; fi
done
if [[ -z "$CANON" ]]; then
  for u in "${CANDIDATES[@]}"; do
    if unit_exists "$u"; then CANON="$u"; break; fi
  done
fi
[[ -n "$CANON" ]] || { echo "ERROR: no ANDRIK web-control systemd unit found" >&2; exit 1; }
echo "Canonical agent unit: $CANON"

# Discover the script launched by ExecStart. Old production uses /usr/local/sbin/andrik-radio-web
# (no .mjs extension), while some historical units point directly at a .mjs file.
EXEC_TEXT="$(systemctl show "$CANON" -p ExecStart --value 2>/dev/null || true)"
TARGET="$(printf '%s\n' "$EXEC_TEXT" | python3 -c 'import re,sys
s=sys.stdin.read()
# Prefer the canonical wrapper path when present.
for p in ["/usr/local/sbin/andrik-radio-web"]:
    if p in s:
        print(p); raise SystemExit
# Otherwise take an absolute JS/MJS agent path from ExecStart.
xs=re.findall(r"(/[A-Za-z0-9_./+-]*(?:andrik-radio-web|andrik-radio-web-agent)[A-Za-z0-9_./+-]*)",s)
print(xs[-1] if xs else "")')"
if [[ -z "$TARGET" ]]; then
  if [[ -e /usr/local/sbin/andrik-radio-web ]]; then TARGET=/usr/local/sbin/andrik-radio-web
  elif [[ -e /usr/local/lib/andrik-radio-web-agent-r721.mjs ]]; then TARGET=/usr/local/lib/andrik-radio-web-agent-r721.mjs
  else TARGET=/usr/local/sbin/andrik-radio-web
  fi
fi
mkdir -p "$(dirname "$TARGET")"
BACKUP=""
if [[ -f "$TARGET" ]]; then
  BACKUP="${TARGET}.bak-before-r803b-${STAMP}"
  cp -a "$TARGET" "$BACKUP"
fi

echo "Agent target: $TARGET"
[[ -n "$BACKUP" ]] && echo "Backup: $BACKUP"

# Preserve current agent cgroup PIDs so only stale standalone duplicates can be removed later.
CGROUP="$(systemctl show "$CANON" -p ControlGroup --value 2>/dev/null || true)"
PROTECT_PIDS_BEFORE=""
if [[ -n "$CGROUP" && -r "/sys/fs/cgroup${CGROUP}/cgroup.procs" ]]; then
  PROTECT_PIDS_BEFORE="$(tr '\n' ' ' < "/sys/fs/cgroup${CGROUP}/cgroup.procs")"
fi

echo "=== INSTALL R803 AGENT TO REAL TARGET ==="
install -m 0755 "$TMP_AGENT" "$TARGET"
node --check "$TARGET"
# Keep a versioned library copy for inspection; it is not used to restart radio.
install -m 0755 "$TMP_AGENT" /usr/local/lib/andrik-radio-web-agent-r803.mjs

echo "=== RESTART WEB CONTROL ONLY ==="
if ! systemctl restart "$CANON"; then
  echo "ERROR: web-control restart failed; rolling back AGENT ONLY" >&2
  [[ -n "$BACKUP" ]] && cp -a "$BACKUP" "$TARGET"
  systemctl restart "$CANON" || true
  exit 1
fi
sleep 6
if ! unit_active "$CANON"; then
  echo "ERROR: R803 web-control is not active; rolling back AGENT ONLY" >&2
  [[ -n "$BACKUP" ]] && cp -a "$BACKUP" "$TARGET"
  systemctl restart "$CANON" || true
  systemctl status "$CANON" --no-pager -l | tail -n 100 || true
  exit 1
fi

# Remove only stale standalone historical web-agent daemons. Never touch anything in the
# canonical web-control cgroup and never touch andrik-radio.service / FFmpeg.
echo "=== SINGLE AGENT CLEANUP (NO RADIO TOUCH) ==="
CGROUP="$(systemctl show "$CANON" -p ControlGroup --value 2>/dev/null || true)"
PROTECTED=""
if [[ -n "$CGROUP" && -r "/sys/fs/cgroup${CGROUP}/cgroup.procs" ]]; then
  PROTECTED="$(tr '\n' ' ' < "/sys/fs/cgroup${CGROUP}/cgroup.procs")"
fi
mapfile -t OLD_PIDS < <(pgrep -f 'node .*andrik-radio-web[^ ]*.*daemon|node .*andrik-radio-web-agent[^ ]*.*daemon' || true)
for p in "${OLD_PIDS[@]:-}"; do
  [[ -n "$p" ]] || continue
  case " $PROTECTED " in *" $p "*) continue;; esac
  CMD="$(tr '\0' ' ' < "/proc/$p/cmdline" 2>/dev/null || true)"
  [[ "$CMD" == *andrik-radio-web* ]] || continue
  echo "Stopping stale agent PID $p: $CMD"
  kill -TERM "$p" 2>/dev/null || true
done
sleep 2
for p in "${OLD_PIDS[@]:-}"; do
  [[ -n "$p" && -d "/proc/$p" ]] || continue
  case " $PROTECTED " in *" $p "*) continue;; esac
  CMD="$(tr '\0' ' ' < "/proc/$p/cmdline" 2>/dev/null || true)"
  [[ "$CMD" == *andrik-radio-web* ]] || continue
  kill -KILL "$p" 2>/dev/null || true
done

echo "=== VERIFY PUBLIC CHECK-IN ==="
VERSION=""
for _ in 1 2 3 4 5 6; do
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
echo "radio active before : $RADIO_ACTIVE_BEFORE"
echo "radio active after  : $RADIO_ACTIVE_AFTER"
echo "radio MainPID before: $RADIO_PID_BEFORE"
echo "radio MainPID after : $RADIO_PID_AFTER"
if [[ -n "$RADIO_PID_BEFORE" && "$RADIO_PID_BEFORE" != "0" && "$RADIO_PID_AFTER" != "$RADIO_PID_BEFORE" ]]; then
  echo "WARNING: radio MainPID changed independently; this installer never calls restart/stop/start on andrik-radio.service" >&2
fi

echo "=== ACTIVE WEB AGENT ==="
systemctl status "$CANON" --no-pager -l | tail -n 25 || true
pgrep -af 'node.*andrik-radio-web.*daemon' || true

echo "=== R803B READY ==="
echo "Canonical web unit: $CANON"
echo "Agent version: R803"
echo "Durable agent log: /var/cache/andrik-radio-r622/diagnostics/r803-agent-events.ndjson"
echo "Merged diagnostics: https://andrikmetal.com/api/public/radio-diagnostics-r803"
echo "Backward endpoint: https://andrikmetal.com/api/public/radio-diagnostics-r802"
echo "Radio/FFmpeg/RTMPS: NOT restarted"

#!/usr/bin/env bash
set -Eeuo pipefail

[ "${EUID}" -eq 0 ] || { echo 'СТОП: запусти через sudo'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
REMOTE="https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main/radio247/server.mjs"
TMP="$(mktemp /tmp/andrik-r775.XXXXXX.mjs)"
BACKUP="$SERVER.bak-before-r775-$(date +%Y%m%d-%H%M%S)"
START_TS=""
trap 'rm -f "$TMP"' EXIT

rollback(){
  echo 'ROLLBACK: возвращаю предыдущий рабочий server'
  if [ -s "$BACKUP" ]; then cp -a "$BACKUP" "$SERVER"; fi
  systemctl restart "$SERVICE" || true
  sleep 12
  systemctl is-active "$SERVICE" || true
}

echo '[1/6] Download R775'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 "$REMOTE?v=$(date +%s)" -o "$TMP"

echo '[2/6] Verify before restart'
node --check "$TMP" >/dev/null
grep -Fq "R775-MINIMAL-STABLE-FADE-NEXT-R767-PRESERVED" "$TMP" || { echo 'СТОП: remote server не R775'; exit 2; }
grep -Fq "R769: filtergraph chains MUST be separated" "$TMP" || { echo 'СТОП: нет fade filtergraph guard'; exit 2; }
grep -Fq "COMMITTED_NEXT_FILE_R769" "$TMP" || { echo 'СТОП: нет committed NEXT'; exit 2; }

echo '[3/6] Backup + install'
cp -a "$SERVER" "$BACKUP"
install -m 0644 "$TMP" "$SERVER"

echo '[4/6] Restart'
START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
if ! systemctl restart "$SERVICE"; then rollback; exit 3; fi
sleep 15
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 3; fi

echo '[5/6] Status'
STATUS="$(curl -fsS --max-time 5 http://127.0.0.1:8080/status 2>/dev/null || true)"
if ! STATUS_JSON="$STATUS" python3 -c 'import json,os,sys; d=json.loads(os.environ.get("STATUS_JSON", "{}")); sys.exit(0 if d.get("version")=="R775-MINIMAL-STABLE-FADE-NEXT-R767-PRESERVED" and d.get("publisherRunning") is True else 1)'; then
  echo 'СТОП: R775 status не подтвердился'
  rollback
  exit 4
fi

echo '[6/6] 35s live guard'
sleep 35
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 5; fi
LOG="$(journalctl -u "$SERVICE" --since "$START_TS" --no-pager 2>/dev/null || true)"
if printf '%s\n' "$LOG" | grep -Eq 'Error parsing filterchain|Trailing garbage after a filter|filter_complex.*Invalid argument|master pipe NO-PROGRESS|status=76/PROTOCOL'; then
  echo 'СТОП: найден critical regression'
  printf '%s\n' "$LOG" | grep -E 'Error parsing filterchain|Trailing garbage after a filter|filter_complex.*Invalid argument|master pipe NO-PROGRESS|status=76/PROTOCOL' | tail -n 20 || true
  rollback
  exit 5
fi

echo 'OK: R775 installed'
printf '%s\n' "$STATUS" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("VERSION:",d.get("version")); print("PUBLISHER:",d.get("publisherRunning")); print("TRANSPORT:",d.get("transportHealthy")); print("NEXT CHECKPOINT:",d.get("committedNextTitle") or "ready"); print("ERROR:",d.get("lastError"))'

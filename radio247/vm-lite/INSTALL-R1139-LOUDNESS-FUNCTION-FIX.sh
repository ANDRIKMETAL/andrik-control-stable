#!/usr/bin/env bash
set -Eeuo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
SAFE="/root/ANDRIK-SAFE/R1139-LOUDNESS-$STAMP"

SCANNER_SRC="$HERE/andrik-radio-loudness-scan-r1137.py"
HELPER_SRC="$HERE/andrik-radio-loudness-new-r1137"
UNIT_SRC="$HERE/andrik-loudness-r1137.service"
AGENT_SRC="$HERE/andrik-radio-web-agent-r803.mjs"

SCANNER_DST="/usr/local/lib/andrik-radio-loudness-scan-r1098.py"
HELPER_DST="/usr/local/sbin/andrik-radio-loudness-new-r1098"
UNIT_DST="/etc/systemd/system/andrik-loudness-r1098.service"
AGENT_DST="/usr/local/lib/andrik-radio-web-agent-r803.mjs"

LOUD_UNIT="andrik-loudness-r1098.service"
AGENT_UNIT="andrik-radio-web-control.service"
RADIO_UNIT="andrik-radio.service"

[[ "$EUID" -eq 0 ]] || { echo "❌ Запусти через sudo"; exit 1; }

for f in "$SCANNER_SRC" "$HELPER_SRC" "$UNIT_SRC" "$AGENT_SRC"; do
  [[ -s "$f" ]] || { echo "❌ Missing $f"; exit 2; }
done

echo "=== R1139 LOUDNESS FUNCTION FIX · PRECHECK ==="
python3 -m py_compile "$SCANNER_SRC"
bash -n "$HELPER_SRC"
node --check "$AGENT_SRC"
grep -Fq "Type=simple" "$UNIT_SRC"
grep -Fq "CPUQuota=8%" "$UNIT_SRC"
grep -Fq "AGENT_VERSION_R803='R1184'" "$AGENT_SRC"
grep -Fq "TemporaryFile" "$SCANNER_SRC"
grep -Fq "systemctl start --no-block" "$HELPER_SRC"

RADIO_PID_BEFORE="$(systemctl show "$RADIO_UNIT" -p MainPID --value 2>/dev/null || true)"
LOUD_STATE_BEFORE="$(systemctl is-active "$LOUD_UNIT" 2>/dev/null || true)"

mkdir -p "$SAFE"
chmod 700 "$SAFE"

backup_one(){
  local src="$1" name="$2"
  if [[ -e "$src" ]]; then cp -a "$src" "$SAFE/$name"; fi
}
backup_one "$SCANNER_DST" scanner.py
backup_one "$HELPER_DST" helper
backup_one "$UNIT_DST" loudness.service
backup_one "$AGENT_DST" agent.mjs

rollback(){
  echo "⚠️ R1139 install failed — rollback"
  [[ -e "$SAFE/scanner.py" ]] && cp -af "$SAFE/scanner.py" "$SCANNER_DST" || true
  [[ -e "$SAFE/helper" ]] && cp -af "$SAFE/helper" "$HELPER_DST" || true
  [[ -e "$SAFE/loudness.service" ]] && cp -af "$SAFE/loudness.service" "$UNIT_DST" || true
  [[ -e "$SAFE/agent.mjs" ]] && cp -af "$SAFE/agent.mjs" "$AGENT_DST" || true
  systemctl daemon-reload || true
  systemctl restart "$AGENT_UNIT" || true
  case "$LOUD_STATE_BEFORE" in
    active|activating|reloading) systemctl start --no-block "$LOUD_UNIT" || true ;;
  esac
}
trap rollback ERR

case "$LOUD_STATE_BEFORE" in
  active|activating|reloading)
    echo "Останавливаю только loudness scanner для безопасной замены..."
    systemctl stop "$LOUD_UNIT" || true
    ;;
esac

install -o root -g root -m 0755 "$SCANNER_SRC" "$SCANNER_DST"
install -o root -g root -m 0755 "$HELPER_SRC" "$HELPER_DST"
install -o root -g root -m 0644 "$UNIT_SRC" "$UNIT_DST"
install -o root -g root -m 0755 "$AGENT_SRC" "$AGENT_DST"

systemctl daemon-reload
systemctl reset-failed "$LOUD_UNIT" >/dev/null 2>&1 || true

python3 -m py_compile "$SCANNER_DST"
bash -n "$HELPER_DST"
node --check "$AGENT_DST"

systemctl restart "$AGENT_UNIT"
sleep 2
systemctl is-active --quiet "$AGENT_UNIT"

case "$LOUD_STATE_BEFORE" in
  active|activating|reloading)
    echo "Продолжаю незавершённый loudness-анализ..."
    systemctl start --no-block "$LOUD_UNIT"
    sleep 1
    NEW_STATE="$(systemctl is-active "$LOUD_UNIT" 2>/dev/null || true)"
    case "$NEW_STATE" in
      active|activating|reloading) echo "✅ loudness resumed: $NEW_STATE" ;;
      *) echo "❌ loudness did not resume: $NEW_STATE"; exit 20 ;;
    esac
    ;;
  *)
    echo "Loudness до установки не работал — автоматически не запускаю."
    ;;
esac

RADIO_PID_AFTER="$(systemctl show "$RADIO_UNIT" -p MainPID --value 2>/dev/null || true)"
if [[ -n "$RADIO_PID_BEFORE" && "$RADIO_PID_BEFORE" != "$RADIO_PID_AFTER" ]]; then
  echo "❌ PID радио изменился: $RADIO_PID_BEFORE -> $RADIO_PID_AFTER"
  exit 21
fi

trap - ERR

echo
echo "=============================================="
echo "✅ R1139 LOUDNESS FUNCTION FIX INSTALLED"
echo "✅ web-agent R1184"
echo "✅ Type=simple → RUNNING отображается честно"
echo "✅ start --no-block → кнопка не висит 30 сек"
echo "✅ stale lastError больше не блокирует здоровые RTMPS 2/2"
echo "✅ ffmpeg stderr больше не может забить PIPE и зависнуть"
echo "✅ старое 'Сейчас: ...' не показывается при READY"
echo "✅ RADIO PID UNCHANGED: ${RADIO_PID_AFTER:-unknown}"
echo "Backup: $SAFE"
echo "=============================================="

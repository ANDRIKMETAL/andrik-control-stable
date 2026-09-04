#!/usr/bin/env bash
set -Eeuo pipefail
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
STAMP="$(date +%Y%m%d-%H%M%S)"
WATCH_URL="${SITE_BASE%/}/radio247/vm-lite/andrik-radio-fullscreen-watchdog-r922?t=$(date +%s)"
RESTORE_URL="${SITE_BASE%/}/radio247/vm-lite/andrik-radio-fullscreen-cache-restore-r908?t=$(date +%s)"
WATCH_TARGET="/usr/local/sbin/andrik-radio-fullscreen-watchdog-r922"
RESTORE_TARGET="/usr/local/sbin/andrik-radio-fullscreen-cache-restore-r908"
UNIT="/etc/systemd/system/andrik-radio-fullscreen-watchdog.service"
TMP_W="$(mktemp /tmp/andrik-r922-watch.XXXXXX)"; TMP_R="$(mktemp /tmp/andrik-r922-restore.XXXXXX)"
trap 'rm -f "$TMP_W" "$TMP_R"' EXIT

echo '======================================================='
echo ' ANDRIK R922 · FULLSCREEN SELF-HEAL WATCHDOG'
echo ' install/start watchdog only · RADIO IS NOT RESTARTED'
echo '======================================================='
RADIO_BEFORE="$(systemctl show -p MainPID --value andrik-radio.service 2>/dev/null || true)"
curl -fsSL --retry 6 --retry-delay 2 "$WATCH_URL" -o "$TMP_W"
curl -fsSL --retry 6 --retry-delay 2 "$RESTORE_URL" -o "$TMP_R"
bash -n "$TMP_W"; bash -n "$TMP_R"
grep -Fq 'R922 · FULLSCREEN SELF-HEAL WATCHDOG' "$TMP_W"
grep -Fq 'ANDRIK R921 · РУБИЛЬНИК ВЕСЬ ЭКРАН' "$TMP_R"
[ -f "$WATCH_TARGET" ] && cp -a "$WATCH_TARGET" "$WATCH_TARGET.before-R922-$STAMP" || true
[ -f "$UNIT" ] && cp -a "$UNIT" "$UNIT.before-R922-$STAMP" || true
install -m 0755 "$TMP_W" "$WATCH_TARGET"
# Keep the already installed proven R921 helper when present; otherwise install it.
if [ ! -x "$RESTORE_TARGET" ]; then install -m 0755 "$TMP_R" "$RESTORE_TARGET"; fi
cat >"$UNIT" <<'EOF'
[Unit]
Description=ANDRIK Radio Fullscreen Self-Heal Watchdog R922
After=network-online.target andrik-radio.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/sbin/andrik-radio-fullscreen-watchdog-r922
Restart=always
RestartSec=3
Nice=10

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now andrik-radio-fullscreen-watchdog.service
sleep 2
RADIO_AFTER="$(systemctl show -p MainPID --value andrik-radio.service 2>/dev/null || true)"
echo "watchdog: $(systemctl is-active andrik-radio-fullscreen-watchdog.service 2>/dev/null || true)"
echo "radio PID before: $RADIO_BEFORE"
echo "radio PID after : $RADIO_AFTER"
if [ "$RADIO_BEFORE" = "$RADIO_AFTER" ]; then echo '✅ Текущий эфир НЕ перезапускался'; else echo '⚠️ Radio PID изменился извне во время установки'; fi
echo '✅ R922 ARMED: после БУДУЩЕГО внешнего restart radio → через ~1s запускается R921 fullscreen switch один раз'
echo '✅ anti-loop cooldown: 90s; собственный restart R921 повторно не срабатывает'
echo 'LOG: journalctl -u andrik-radio-fullscreen-watchdog.service -n 60 --no-pager'
echo 'OFF: systemctl disable --now andrik-radio-fullscreen-watchdog.service'

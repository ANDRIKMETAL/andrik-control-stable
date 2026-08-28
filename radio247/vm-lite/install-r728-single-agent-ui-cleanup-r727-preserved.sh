#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

SITE_BASE="${ANDRIK_SITE_BASE:-https://andrikmetal.com}"
AGENT_SERVICE=andrik-radio-web.service
LEGACY_SERVICE=andrik-radio-web-control.service
AGENT_LIB=/usr/local/lib/andrik-radio-web-agent-r721.mjs
AGENT_TARGET=/usr/local/sbin/andrik-radio-web
RADIO_SERVICE=andrik-radio.service
TMP_DIR="$(mktemp -d /tmp/andrik-r728.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

for c in curl node python3 systemctl pgrep; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done

echo '[1/8] Загружаю единый persistent Agent R721 для R728…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-radio-web-agent-r721.mjs?v=55.00-r728-$(date +%s)" \
  -o "$TMP_DIR/agent.mjs"
node --check "$TMP_DIR/agent.mjs" >/dev/null
grep -Fq "version:'R721'" "$TMP_DIR/agent.mjs" || { echo 'СТОП: скачанный агент не R721'; exit 3; }
grep -Fq "JSON.stringify({version:'R721',status})" "$TMP_DIR/agent.mjs" || { echo 'СТОП: heartbeat R721 отсутствует'; exit 3; }

echo '[2/8] Фиксирую состояние LIVE до правки агента…'
BEFORE="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
BEFORE_PUB="$(printf '%s' "$BEFORE" | python3 -c 'import sys,json
try: print("1" if json.load(sys.stdin).get("publisherRunning") else "0")
except Exception: print("0")' 2>/dev/null || echo 0)"
printf '%s\n' "$BEFORE" | python3 -c 'import sys,json
try:
 d=json.load(sys.stdin); print("Radio:",d.get("version","?"),"publisher=",d.get("publisherRunning"),"producer=",d.get("producerRunning"))
except Exception: print("Radio status пока не прочитан")' || true

TS="$(date +%Y%m%d-%H%M%S)"
echo '[3/8] Делаю резервные копии агента…'
[ -s "$AGENT_LIB" ] && cp -a "$AGENT_LIB" "$AGENT_LIB.bak-r728-$TS" || true
[ -s "$AGENT_TARGET" ] && cp -a "$AGENT_TARGET" "$AGENT_TARGET.bak-r728-$TS" || true
if [ -f "/etc/systemd/system/$LEGACY_SERVICE" ] && [ ! -L "/etc/systemd/system/$LEGACY_SERVICE" ]; then
  cp -a "/etc/systemd/system/$LEGACY_SERVICE" "/etc/systemd/system/$LEGACY_SERVICE.bak-r728-$TS"
fi

# R715/R658 and R721 historically used two different systemd unit names.
# When both are enabled they poll the same Cloudflare queue with the same token,
# making the displayed version jump backwards and allowing a legacy agent to steal commands.
echo '[4/8] Останавливаю и навсегда блокирую старый параллельный agent service…'
systemctl disable --now "$LEGACY_SERVICE" >/dev/null 2>&1 || true
if [ -e "/etc/systemd/system/$LEGACY_SERVICE" ] || [ -L "/etc/systemd/system/$LEGACY_SERVICE" ]; then
  rm -f "/etc/systemd/system/$LEGACY_SERVICE"
fi
ln -s /dev/null "/etc/systemd/system/$LEGACY_SERVICE"

mkdir -p /usr/local/lib /usr/local/sbin
echo '[5/8] Ставлю один Agent R721…'
install -m 0644 "$TMP_DIR/agent.mjs" "$AGENT_LIB"
cat > "$AGENT_TARGET" <<'WRAP'
#!/usr/bin/env bash
exec /usr/bin/node /usr/local/lib/andrik-radio-web-agent-r721.mjs "$@"
WRAP
chmod 0755 "$AGENT_TARGET"
cat > "/etc/systemd/system/$AGENT_SERVICE" <<'UNIT'
[Unit]
Description=ANDRIK Radio Web Agent R721 · R728 Single-Agent Guard
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
ExecStart=/usr/local/sbin/andrik-radio-web daemon
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT

# Important: only the agent is restarted. The encoder/publisher is intentionally untouched.
echo '[6/8] Перезапускаю ТОЛЬКО web-agent — эфир не рестартую…'
systemctl daemon-reload
systemctl enable --now "$AGENT_SERVICE" >/dev/null
systemctl restart "$AGENT_SERVICE"
sleep 7
systemctl is-active --quiet "$AGENT_SERVICE" || { systemctl status "$AGENT_SERVICE" --no-pager -l || true; journalctl -u "$AGENT_SERVICE" -n 100 --no-pager || true; exit 4; }
if systemctl is-active --quiet "$LEGACY_SERVICE"; then
  echo 'СТОП: старый параллельный agent всё ещё active'
  systemctl status "$LEGACY_SERVICE" --no-pager -l || true
  exit 4
fi

# There must be exactly one daemon process and it must be R721.
echo '[7/8] Проверяю, что агент теперь один…'
PROCS="$(pgrep -af 'andrik-radio-web-agent-r[0-9]+\.mjs.*daemon' || true)"
printf '%s\n' "$PROCS"
COUNT="$(printf '%s\n' "$PROCS" | grep -c . || true)"
[ "$COUNT" -eq 1 ] || { echo "СТОП: найдено процессов agent: $COUNT (ожидался 1)"; exit 5; }
printf '%s\n' "$PROCS" | grep -Fq 'andrik-radio-web-agent-r721.mjs' || { echo 'СТОП: единственный процесс не R721'; exit 5; }

# We deliberately do not restart andrik-radio.service. If it was publishing before,
# it must still be publishing after the cleanup.
echo '[8/8] Проверяю, что LIVE не тронут…'
AFTER="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
printf '%s\n' "$AFTER" | python3 -c 'import sys,json
try:
 d=json.load(sys.stdin); print("Radio:",d.get("version","?"),"publisher=",d.get("publisherRunning"),"producer=",d.get("producerRunning"))
except Exception: raise SystemExit(2)'
if [ "$BEFORE_PUB" = 1 ]; then
  printf '%s' "$AFTER" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("publisherRunning") else 1)' || { echo 'СТОП: publisher был LIVE до R728, но после правки агента не подтверждён'; exit 6; }
fi

echo
echo '========================================================'
echo '✅ R728 AGENT CLEANUP ГОТОВ'
echo '✅ старый andrik-radio-web-control.service остановлен + замаскирован'
echo '✅ работает ровно один Agent R721'
echo '✅ версия больше не должна прыгать на R658/R715'
echo '✅ andrik-radio.service НЕ перезапускался'
echo '✅ FULL-FIT кнопка/старая ошибка убраны в R728 UI'
echo '✅ ADMIN_KEY перенесён в низ страницы Видео эфира'
echo '========================================================'

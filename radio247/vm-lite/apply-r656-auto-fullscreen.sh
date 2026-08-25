#!/usr/bin/env bash
set -Eeuo pipefail
BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
AGENT_SRC="$BASE/radio247/vm-lite/andrik-radio-web-agent-r650.mjs"
AUTO_SRC="$BASE/radio247/vm-lite/andrik-visual-auto-r656.sh"
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
ENV_FILE=/etc/andrik-radio.env

[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$AGENT_SRC" ] || { echo "СТОП: нет $AGENT_SRC"; exit 3; }
[ -s "$AUTO_SRC" ] || { echo "СТОП: нет $AUTO_SRC"; exit 4; }
node --check "$SERVER" >/dev/null
node --check "$AGENT_SRC" >/dev/null
bash -n "$AUTO_SRC"

# One exact fullscreen transform for DAY / EVENING / NIGHT. No cover/crop mode.
sed -i "s|'scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos',|'scale=1920:1080:flags=lanczos',|; /'crop=1920:1080',/d" "$SERVER"
node --check "$SERVER" >/dev/null
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$SERVER"; then
  echo 'СТОП: найден старый crop/cover фильтр'; exit 5
fi
grep -q "'scale=1920:1080:flags=lanczos'" "$SERVER" || { echo 'СТОП: нет direct 1920x1080 scale'; exit 6; }

# Protect ALL THREE current local masters from background R2 sync/bootstrap.
mkdir -p "$VISUAL_DIR"
printf 'R656 protected local DAY EVENING NIGHT\n' > "$VISUAL_DIR/.protect-local-visuals-r656"
printf 'R656 compatibility lock\n' > "$VISUAL_DIR/.protect-local-visuals-r655"
chmod 600 "$VISUAL_DIR/.protect-local-visuals-r656" "$VISUAL_DIR/.protect-local-visuals-r655"

# AUTO mode: no forced slot. Server chooses by Europe/Bratislava at every restart.
touch "$ENV_FILE"
sed -i '/^[[:space:]]*FORCE_VISUAL_SLOT[[:space:]]*=/d' "$ENV_FILE"
chmod 600 "$ENV_FILE" || true

# Protected web agent: normal sync cannot overwrite any existing local master.
install -m 755 "$AGENT_SRC" /usr/local/sbin/andrik-radio-web
install -m 755 "$AGENT_SRC" /usr/local/lib/andrik-radio-web-agent-r650.mjs

# Automatic time switch watchdog. It only restarts the radio when the time period changes;
# it NEVER downloads or replaces visual files.
install -m 755 "$AUTO_SRC" /usr/local/sbin/andrik-visual-auto-r656
cat >/etc/systemd/system/andrik-visual-auto-r656.service <<'UNIT'
[Unit]
Description=ANDRIK Radio automatic DAY EVENING NIGHT visual switch R656
After=andrik-radio.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/andrik-visual-auto-r656
UNIT
cat >/etc/systemd/system/andrik-visual-auto-r656.timer <<'UNIT'
[Unit]
Description=ANDRIK Radio visual schedule watchdog R656

[Timer]
OnBootSec=45s
OnUnitActiveSec=60s
AccuracySec=10s
Persistent=true
Unit=andrik-visual-auto-r656.service

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now andrik-visual-auto-r656.timer >/dev/null
systemctl restart andrik-radio-web-control.service
systemctl restart andrik-radio.service
sleep 8

echo 'R656 AUTO FULLSCREEN ✅'
echo 'DAY 08:00–17:00 · EVENING 17:00–22:00 · NIGHT 22:00–08:00 · Europe/Bratislava'
echo 'All 3 local masters protected · direct 1920x1080 · no crop · no R2 background overwrite.'
curl -fsS http://127.0.0.1:8080/status || true
echo
systemctl is-active andrik-visual-auto-r656.timer || true

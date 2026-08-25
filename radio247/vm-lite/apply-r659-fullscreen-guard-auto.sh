#!/usr/bin/env bash
set -Eeuo pipefail
BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
GUARD_SRC="$BASE/radio247/vm-lite/andrik-fullscreen-guard-r659.sh"
AUTO_SRC="$BASE/radio247/vm-lite/andrik-visual-auto-r659.sh"
ENV_FILE=/etc/andrik-radio.env
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$GUARD_SRC" ] || { echo "СТОП: нет $GUARD_SRC"; exit 3; }
[ -s "$AUTO_SRC" ] || { echo "СТОП: нет $AUTO_SRC"; exit 4; }
bash -n "$GUARD_SRC"; bash -n "$AUTO_SRC"; node --check "$SERVER" >/dev/null
install -m 755 "$GUARD_SRC" /usr/local/sbin/andrik-fullscreen-guard-r659
install -m 755 "$AUTO_SRC" /usr/local/sbin/andrik-visual-auto-r659
/usr/local/sbin/andrik-fullscreen-guard-r659

# Permanent safety net: EVERY andrik-radio.service start/restart re-applies fullscreen
# before Node/FFmpeg can start, regardless of which panel/timer requested the restart.
mkdir -p /etc/systemd/system/andrik-radio.service.d
cat >/etc/systemd/system/andrik-radio.service.d/20-fullscreen-guard-r659.conf <<'UNIT'
[Service]
ExecStartPre=+/usr/local/sbin/andrik-fullscreen-guard-r659
UNIT

mkdir -p "$VISUAL_DIR"; touch "$ENV_FILE"
sed -i '/^[[:space:]]*VISUAL_AUTO_SCHEDULE_R658[[:space:]]*=/d' "$ENV_FILE"
printf 'VISUAL_AUTO_SCHEDULE_R658=1\n' >> "$ENV_FILE"
printf 'R659 protect local DAY EVENING NIGHT\n' > "$VISUAL_DIR/.protect-local-visuals-r656"
printf 'R659 protect local DAY EVENING NIGHT\n' > "$VISUAL_DIR/.protect-local-visuals-r655"
rm -f "$VISUAL_DIR/.manual-visual-r658"
chmod 600 "$ENV_FILE" "$VISUAL_DIR/.protect-local-visuals-r656" "$VISUAL_DIR/.protect-local-visuals-r655" || true

systemctl disable --now andrik-visual-auto-r656.timer andrik-visual-auto-r658.timer >/dev/null 2>&1 || true
rm -f /etc/systemd/system/andrik-visual-auto-r656.timer /etc/systemd/system/andrik-visual-auto-r656.service
rm -f /etc/systemd/system/andrik-visual-auto-r658.timer /etc/systemd/system/andrik-visual-auto-r658.service
cat >/etc/systemd/system/andrik-visual-auto-r659.service <<'UNIT'
[Unit]
Description=ANDRIK guarded fullscreen automatic visual switch R659
After=andrik-radio.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/andrik-visual-auto-r659 timer
UNIT
cat >/etc/systemd/system/andrik-visual-auto-r659.timer <<'UNIT'
[Unit]
Description=ANDRIK guarded fullscreen DAY EVENING NIGHT watchdog R659
[Timer]
OnBootSec=40s
OnUnitActiveSec=60s
AccuracySec=10s
Persistent=true
Unit=andrik-visual-auto-r659.service
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now andrik-visual-auto-r659.timer >/dev/null
/usr/local/sbin/andrik-visual-auto-r659 force
sleep 8
echo 'R659 PERMANENT FULLSCREEN GUARD ✅'
echo 'Every radio start has ExecStartPre fullscreen enforcement + automatic DAY/EVENING/NIGHT.'
curl -fsS http://127.0.0.1:8080/status || true
echo
systemctl is-active andrik-visual-auto-r659.timer || true

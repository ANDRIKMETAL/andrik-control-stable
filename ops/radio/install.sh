#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$(id -u)" -eq 0 ]] || { echo "Run with sudo"; exit 1; }
TARGET=/opt/andrik-radio/radio247/server.mjs
BASELINE=bdd45e10e8e5ea828b8722881c9044f5ee8da11ba0d0288b3a7c2d78a956ba6d
[[ -f "$TARGET" ]] || { echo "Radio server missing"; exit 1; }
actual=$(sha256sum "$TARGET" | awk '{print $1}')
[[ "$actual" == "$BASELINE" ]] || { echo "Refusing install: VPS server checksum differs from verified R1529 ($actual)"; exit 1; }
command -v node >/dev/null
command -v curl >/dev/null
command -v flock >/dev/null
systemctl cat andrik-radio.service >/dev/null
mkdir -p /usr/local/lib/andrik-radio-deploy /var/backups/andrik-radio-deploy /var/lib/andrik-radio-deploy
cp -p "$TARGET" "/var/backups/andrik-radio-deploy/baseline-R1529-$BASELINE.mjs"
curl -fsSL --connect-timeout 8 --max-time 30 https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main/ops/radio/update.sh -o /usr/local/lib/andrik-radio-deploy/update.sh
chmod 0755 /usr/local/lib/andrik-radio-deploy/update.sh
cat > /etc/systemd/system/andrik-radio-git-deploy.service <<'UNIT'
[Unit]
Description=ANDRIK Radio safe GitHub release deploy
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/lib/andrik-radio-deploy/update.sh
TimeoutStartSec=180
UNIT
cat > /etc/systemd/system/andrik-radio-git-deploy.timer <<'UNIT'
[Unit]
Description=Check approved ANDRIK Radio release every 5 minutes
[Timer]
OnBootSec=3min
OnUnitInactiveSec=5min
RandomizedDelaySec=30s
Persistent=true
Unit=andrik-radio-git-deploy.service
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now andrik-radio-git-deploy.timer
echo "Installed. Baseline-only manifest: no radio restart or deployment."
systemctl status andrik-radio-git-deploy.timer --no-pager

#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then
  echo "Запусти: sudo bash uninstall-andrik-radio.sh"
  exit 1
fi
systemctl disable --now andrik-radio.service 2>/dev/null || true
systemctl disable --now andrik-radio-update.timer 2>/dev/null || true
rm -f /etc/systemd/system/andrik-radio.service \
      /etc/systemd/system/andrik-radio-update.service \
      /etc/systemd/system/andrik-radio-update.timer \
      /usr/local/sbin/andrik-radio-update \
      /etc/andrik-radio.env
systemctl daemon-reload
rm -rf /opt/andrik-radio
echo "ANDRIK Radio удалено с VM."

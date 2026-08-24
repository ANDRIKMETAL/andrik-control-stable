#!/usr/bin/env bash
set -Eeuo pipefail
BASE=/opt/andrik-radio
GUARD_SRC="$BASE/radio247/vm-lite/andrik-ensure-qr-png-r646.sh"
GUARD_DST=/usr/local/sbin/andrik-ensure-qr-png-r646
DROPIN=/etc/systemd/system/andrik-radio.service.d

[ "${EUID}" -eq 0 ] || { echo "Запусти через sudo."; exit 1; }
[ -x "$GUARD_SRC" ] || { echo "Нет R646 QR guard: $GUARD_SRC"; exit 2; }

printf '[1/4] Проверяю настоящий PNG в R646...\n'
file "$BASE/assets/andrik-qr-r612.png"
file "$BASE/assets/andrik-qr-r612-r646-safe.png"

printf '[2/4] Ставлю автоматическую защиту QR перед каждым запуском радио...\n'
install -m 0755 "$GUARD_SRC" "$GUARD_DST"
mkdir -p "$DROPIN"
cat > "$DROPIN/r646-qr-guard.conf" <<EOF
[Service]
ExecStartPre=$GUARD_DST
EOF
systemctl daemon-reload

printf '[3/4] Исправляю текущий QR, если это требуется...\n'
"$GUARD_DST"
file "$BASE/assets/andrik-qr-r612.png"

printf '[4/4] Один restart и статус...\n'
systemctl restart andrik-radio.service
sleep 8
curl -fsS http://127.0.0.1:8080/status | python3 -m json.tool

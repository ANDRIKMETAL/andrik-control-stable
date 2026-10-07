#!/usr/bin/env bash
set -Eeuo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/andrik-radio-web-agent-r803.mjs"
TARGET="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

[ "$EUID" -eq 0 ] || { echo "❌ Нужен sudo"; exit 1; }
[ -s "$SRC" ] || { echo "❌ Новый агент не найден"; exit 1; }
[ -s "$TARGET" ] || { echo "❌ Установленный web-agent не найден"; exit 1; }
node --check "$SRC"
grep -Fq "R1263-FACEBOOK-CONTROL-SYNC" "$SRC" || { echo "❌ R1263 marker missing"; exit 1; }

UNIT=""
for u in andrik-radio-web-control.service andrik-radio-web-agent.service; do
  if systemctl cat "$u" >/dev/null 2>&1; then UNIT="$u"; break; fi
done
[ -n "$UNIT" ] || { echo "❌ Web-agent systemd unit не найден"; exit 1; }

RADIO_BEFORE="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
mkdir -p /root/ANDRIK-SAFE
BACKUP="/root/ANDRIK-SAFE/andrik-radio-web-agent.pre-R1263-$STAMP.mjs"
cp -a "$TARGET" "$BACKUP"
TMP="$(mktemp ${TARGET}.R1263.XXXXXX)"
cp "$SRC" "$TMP"
chmod --reference="$TARGET" "$TMP"
chown --reference="$TARGET" "$TMP" 2>/dev/null || true
mv -f "$TMP" "$TARGET"

if ! systemctl restart "$UNIT"; then
  cp -a "$BACKUP" "$TARGET"
  systemctl restart "$UNIT" || true
  echo "❌ Новый агент не стартовал. Старый восстановлен."
  exit 1
fi
sleep 2
if ! systemctl is-active --quiet "$UNIT"; then
  cp -a "$BACKUP" "$TARGET"
  systemctl restart "$UNIT" || true
  echo "❌ Web-agent inactive. Старый восстановлен."
  exit 1
fi
RADIO_AFTER="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
echo "✅ R1263 Facebook Control Sync agent установлен"
echo "✅ Перезапущен только: $UNIT"
echo "✅ Backup: $BACKUP"
echo "RADIO PID before/after: $RADIO_BEFORE / $RADIO_AFTER"
if [ -n "$RADIO_BEFORE" ] && [ "$RADIO_BEFORE" != "$RADIO_AFTER" ]; then
  echo "⚠️ Radio PID изменился неожиданно — проверь status"
else
  echo "✅ Radio / YouTube НЕ перезапускались"
fi

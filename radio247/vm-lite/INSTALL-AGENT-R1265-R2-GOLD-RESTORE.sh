#!/usr/bin/env bash
set -Eeuo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SRC_AGENT="$HERE/andrik-radio-web-agent-r803.mjs"
SRC_FULL="$HERE/andrik-radio-fullscreen-r1383"
SRC_GUARD="$HERE/andrik-r1383-global-hard-fullscreen-guard"
SRC_GOLD="$HERE/andrik-radio-r2-gold-restore-r1265"
TARGET_AGENT="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
TARGET_FULL="/usr/local/sbin/andrik-radio-fullscreen-r1383"
TARGET_GUARD="/usr/local/sbin/andrik-r1383-global-hard-fullscreen-guard"
TARGET_GOLD="/usr/local/sbin/andrik-radio-r2-gold-restore-r1265"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

[ "$EUID" -eq 0 ] || { echo "❌ Нужен sudo"; exit 1; }
[ -s "$SRC_AGENT" ] || { echo "❌ Новый web-agent не найден"; exit 2; }
[ -s "$SRC_FULL" ] || { echo "❌ R1383 fullscreen helper не найден"; exit 3; }
[ -s "$SRC_GUARD" ] || { echo "❌ R1383 fullscreen guard не найден"; exit 4; }
[ -s "$SRC_GOLD" ] || { echo "❌ R1265 R2 GOLD helper не найден"; exit 5; }
[ -s "$TARGET_AGENT" ] || { echo "❌ Установленный web-agent не найден"; exit 6; }

node --check "$SRC_AGENT"
bash -n "$SRC_FULL"
bash -n "$SRC_GUARD"
bash -n "$SRC_GOLD"
grep -Fq "R1265-R2-GOLD-RESTORE" "$SRC_AGENT" || { echo "❌ R1265 marker missing"; exit 7; }
grep -Fq "fullscreen-r1383" "$SRC_AGENT" || { echo "❌ fullscreen action missing"; exit 8; }
grep -Fq "R2 COMPACT GOLD RESTORE" "$SRC_GOLD" || { echo "❌ R1265 GOLD helper marker missing"; exit 9; }

UNIT=""
for u in andrik-radio-web-control.service andrik-radio-web-agent.service; do
  if systemctl cat "$u" >/dev/null 2>&1; then UNIT="$u"; break; fi
done
[ -n "$UNIT" ] || { echo "❌ Web-agent systemd unit не найден"; exit 10; }

RADIO_BEFORE="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
mkdir -p /root/ANDRIK-SAFE
BACK_DIR="/root/ANDRIK-SAFE/R1265-R2-GOLD-RESTORE-$STAMP"
mkdir -p "$BACK_DIR"
cp -a "$TARGET_AGENT" "$BACK_DIR/andrik-radio-web-agent.before.mjs"
[ -e "$TARGET_FULL" ] && cp -a "$TARGET_FULL" "$BACK_DIR/andrik-radio-fullscreen-r1383.before" || true
[ -e "$TARGET_GUARD" ] && cp -a "$TARGET_GUARD" "$BACK_DIR/andrik-r1383-global-hard-fullscreen-guard.before" || true
[ -e "$TARGET_GOLD" ] && cp -a "$TARGET_GOLD" "$BACK_DIR/andrik-radio-r2-gold-restore-r1265.before" || true

install -m 0755 "$SRC_FULL" "$TARGET_FULL"
install -m 0755 "$SRC_GUARD" "$TARGET_GUARD"
install -m 0755 "$SRC_GOLD" "$TARGET_GOLD"
TMP="$(mktemp ${TARGET_AGENT}.R1265.XXXXXX)"
cp "$SRC_AGENT" "$TMP"
chmod --reference="$TARGET_AGENT" "$TMP"
chown --reference="$TARGET_AGENT" "$TMP" 2>/dev/null || true
mv -f "$TMP" "$TARGET_AGENT"

if ! systemctl restart "$UNIT"; then
  cp -a "$BACK_DIR/andrik-radio-web-agent.before.mjs" "$TARGET_AGENT"
  systemctl restart "$UNIT" || true
  echo "❌ Новый агент не стартовал. Старый агент восстановлен."
  exit 20
fi
sleep 2
if ! systemctl is-active --quiet "$UNIT"; then
  cp -a "$BACK_DIR/andrik-radio-web-agent.before.mjs" "$TARGET_AGENT"
  systemctl restart "$UNIT" || true
  echo "❌ Web-agent inactive. Старый агент восстановлен."
  exit 21
fi
RADIO_AFTER="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"

echo "======================================================"
echo "✅ R1265 R2 GOLD RESTORE + R1264 FULLSCREEN INSTALLED"
echo "✅ GOLD button: Cloudflare R2 Compact GOLD 2026-10-07 + SHA256"
echo "✅ GOLD helper: $TARGET_GOLD"
echo "✅ Кнопка может запускать R1383 Global Hard Fullscreen"
echo "✅ Helper: $TARGET_FULL"
echo "✅ Guard : $TARGET_GUARD"
echo "✅ Перезапущен только web-agent: $UNIT"
echo "✅ Радио этой установкой НЕ перезапускалось"
echo "Backup: $BACK_DIR"
echo "RADIO PID before/after: $RADIO_BEFORE / $RADIO_AFTER"
if [ -n "$RADIO_BEFORE" ] && [ "$RADIO_BEFORE" != "$RADIO_AFTER" ]; then
  echo "⚠️ Radio PID изменился неожиданно — проверь эфир"
else
  echo "✅ Radio PID untouched"
fi
echo "======================================================"

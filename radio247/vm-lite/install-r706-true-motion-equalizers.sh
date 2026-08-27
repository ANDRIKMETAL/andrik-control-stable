#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_DIR="$(mktemp -d /tmp/andrik-r706.XXXXXX)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
ENGINE_DROPIN="$DROPIN_DIR/r706-engine.conf"
trap 'rm -rf "$TMP_DIR"' EXIT

command -v curl >/dev/null || { echo 'СТОП: curl не найден'; exit 2; }
command -v node >/dev/null || { echo 'СТОП: node не найден'; exit 2; }
command -v ffmpeg >/dev/null || { echo 'СТОП: ffmpeg не найден'; exit 2; }
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/6] Загружаю R706 TRUE-MOTION engine…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r706-$(date +%s)" -o "$TMP_DIR/server.mjs"
node --check "$TMP_DIR/server.mjs" >/dev/null

grep -q 'R706-TRUE-MOTION-FOUR-EQUALIZERS-R705-PRESERVED' "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R706'; exit 3; }
grep -q 'R706-GEQ-FRAME-ANIMATED' "$TMP_DIR/server.mjs" || { echo 'СТОП: нет R706 GEQ engine'; exit 3; }
grep -q 'liveEqualizerFilterComplexR706' "$TMP_DIR/server.mjs" || { echo 'СТОП: нет true-motion filter complex'; exit 3; }
grep -q "geq=r='" "$TMP_DIR/server.mjs" || { echo 'СТОП: GEQ фильтр отсутствует'; exit 3; }
grep -q 'sin(N\*' "$TMP_DIR/server.mjs" || { echo 'СТОП: frame animation N отсутствует'; exit 3; }
grep -q 'morning-soft-gold-motion' "$TMP_DIR/server.mjs" || { echo 'СТОП: нет MORNING motion'; exit 3; }
grep -q 'day-steel-motion' "$TMP_DIR/server.mjs" || { echo 'СТОП: нет DAY motion'; exit 3; }
grep -q 'evening-amber-motion' "$TMP_DIR/server.mjs" || { echo 'СТОП: нет EVENING motion'; exit 3; }
grep -q 'night-blue-motion' "$TMP_DIR/server.mjs" || { echo 'СТОП: нет NIGHT motion'; exit 3; }
grep -q 'ensureNextTrackReadyR702' "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян R702 MP3 handoff'; exit 3; }
grep -q 'force_original_aspect_ratio=decrease' "$TMP_DIR/server.mjs" || { echo 'СТОП: AUTO FIT отсутствует'; exit 3; }
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$TMP_DIR/server.mjs"; then
  echo 'СТОП: найден crop/cover — не ставлю.'
  exit 3
fi

echo '[2/6] Резервная копия текущего engine…'
TS="$(date +%Y%m%d-%H%M%S)"
cp -a "$SERVER" "$SERVER.bak-r706-$TS"

echo '[3/6] Ставлю R706 без изменения MP3, R2, ключа YouTube и расписания…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"
mkdir -p "$DROPIN_DIR"
rm -f "$DROPIN_DIR/r702-engine.conf" "$DROPIN_DIR/r703-engine.conf" "$DROPIN_DIR/r704-engine.conf" "$DROPIN_DIR/r705-engine.conf"
cat > "$ENGINE_DROPIN" <<DROPIN
[Service]
ExecStart=
ExecStart=/usr/bin/node $SERVER
DROPIN
systemctl daemon-reload

echo '[4/6] Перезапускаю только радио…'
systemctl restart "$SERVICE"

echo '[5/6] Проверяю здоровье и TRUE-MOTION engine…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  sleep 2
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | grep -q 'R706-TRUE-MOTION-FOUR-EQUALIZERS-R705-PRESERVED'; then
    if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("publisherRunning") and d.get("equalizerStyle") and d.get("equalizerEngine")=="R706-GEQ-FRAME-ANIMATED" else 1)' 2>/dev/null; then
      OK=1; break
    fi
  fi
done
[ "$OK" = 1 ] || { echo 'R706 не стал healthy.'; printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true; journalctl -u "$SERVICE" -n 100 --no-pager || true; exit 5; }
printf '%s\n' "$STATUS" | python3 -m json.tool

echo '[6/6] ГОТОВО — R706'
echo '✅ STATIC drawbox animation УДАЛЕНА'
echo '✅ GEQ пересчитывает высоту столбиков КАЖДЫЙ КАДР'
echo '✅ УТРО: мягкое золотое движение'
echo '✅ ДЕНЬ: активное светло-стальное движение'
echo '✅ ВЕЧЕР: янтарное глубокое движение'
echo '✅ НОЧЬ: спокойное голубое движение'
echo '✅ Позиция: ниже имени трека, выше бегущей строки'
echo '✅ В клипах equalizer скрыт'
echo '✅ R703 расписание + R702 MP3/CLIP handoff сохранены'

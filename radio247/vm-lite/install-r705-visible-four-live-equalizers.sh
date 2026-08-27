#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_DIR="$(mktemp -d /tmp/andrik-r704.XXXXXX)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
ENGINE_DROPIN="$DROPIN_DIR/r705-engine.conf"
trap 'rm -rf "$TMP_DIR"' EXIT

command -v curl >/dev/null || { echo 'СТОП: curl не найден'; exit 2; }
command -v node >/dev/null || { echo 'СТОП: node не найден'; exit 2; }
command -v ffmpeg >/dev/null || { echo 'СТОП: ffmpeg не найден'; exit 2; }
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/6] Загружаю R705 visible equalizer engine…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r704-$(date +%s)" -o "$TMP_DIR/server.mjs"
node --check "$TMP_DIR/server.mjs" >/dev/null

grep -q 'R705-VISIBLE-FOUR-LIVE-EQUALIZERS-R704-PRESERVED' "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R704'; exit 3; }
grep -q 'liveEqualizerFiltersR704' "$TMP_DIR/server.mjs" || { echo 'СТОП: нет живого equalizer engine'; exit 3; }
grep -q "morning-soft-gold-visible" "$TMP_DIR/server.mjs" || { echo 'СТОП: нет MORNING equalizer'; exit 3; }
grep -q "day-steel-visible" "$TMP_DIR/server.mjs" || { echo 'СТОП: нет DAY equalizer'; exit 3; }
grep -q "evening-amber-visible" "$TMP_DIR/server.mjs" || { echo 'СТОП: нет EVENING equalizer'; exit 3; }
grep -q "night-blue-visible" "$TMP_DIR/server.mjs" || { echo 'СТОП: нет NIGHT equalizer'; exit 3; }
grep -q "baseOffset=88" "$TMP_DIR/server.mjs" || { echo 'СТОП: equalizer position guard missing'; exit 3; }
grep -q 'ensureNextTrackReadyR702' "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян R702 MP3 handoff'; exit 3; }
grep -q 'force_original_aspect_ratio=decrease' "$TMP_DIR/server.mjs" || { echo 'СТОП: AUTO FIT отсутствует'; exit 3; }
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$TMP_DIR/server.mjs"; then
  echo 'СТОП: найден crop/cover — не ставлю.'
  exit 3
fi

echo '[2/6] Резервная копия текущего engine…'
TS="$(date +%Y%m%d-%H%M%S)"
cp -a "$SERVER" "$SERVER.bak-r704-$TS"

echo '[3/6] Ставлю R704 без изменения MP3, R2, ключа YouTube и расписания…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"
mkdir -p "$DROPIN_DIR"
rm -f "$DROPIN_DIR/r702-engine.conf" "$DROPIN_DIR/r703-engine.conf" "$DROPIN_DIR/r704-engine.conf"
cat > "$ENGINE_DROPIN" <<DROPIN
[Service]
ExecStart=
ExecStart=/usr/bin/node $SERVER
DROPIN
systemctl daemon-reload

echo '[4/6] Перезапускаю только радио…'
systemctl restart "$SERVICE"

echo '[5/6] Проверяю здоровье и активный стиль…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  sleep 2
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | grep -q 'R705-VISIBLE-FOUR-LIVE-EQUALIZERS-R704-PRESERVED'; then
    if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("publisherRunning") and d.get("equalizerStyle") else 1)' 2>/dev/null; then
      OK=1; break
    fi
  fi
done
[ "$OK" = 1 ] || { echo 'R705 не стал healthy.'; printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true; journalctl -u "$SERVICE" -n 80 --no-pager || true; exit 5; }
printf '%s\n' "$STATUS" | python3 -m json.tool

echo '[6/6] ГОТОВО — R705'
echo '✅ УТРО 06:00–12:00: мягкий тёплый equalizer'
echo '✅ ДЕНЬ 12:00–18:00: светлый steel equalizer'
echo '✅ ВЕЧЕР 18:00–24:00: янтарный equalizer'
echo '✅ НОЧЬ 00:00–06:00: холодный blue equalizer'
echo '✅ Линия расположена между названием песни и бегущей строкой и заметна на телефоне.'
echo '✅ Движение плавное и постоянное; высота и яркость усилены без вмешательства в аудио.'
echo '✅ Во время настоящего видеоклипа equalizer скрывается, чтобы не портить клип.'
echo '✅ R703 4 периода и R702 MP3/CLIP handoff сохранены.'

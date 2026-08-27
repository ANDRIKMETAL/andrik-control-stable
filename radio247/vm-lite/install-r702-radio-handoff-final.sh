#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
QR="$BASE/assets/andrik-qr-r612.png"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-radio-r702.XXXXXX.mjs)"
BACKUP="$SERVER.bak-r702-$(date +%Y%m%d-%H%M%S)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
ENGINE_DROPIN="$DROPIN_DIR/r702-engine.conf"
CACHE_DIR=/var/cache/andrik-radio-r622
trap 'rm -f "$TMP"' EXIT

png_ok(){ [ -s "$1" ] && [ "$(od -An -tx1 -N8 "$1" 2>/dev/null | tr -d ' \n')" = "89504e470d0a1a0a" ]; }

[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
command -v node >/dev/null || { echo 'СТОП: node не найден'; exit 2; }
command -v ffmpeg >/dev/null || { echo 'СТОП: ffmpeg не найден'; exit 2; }
command -v ffprobe >/dev/null || { echo 'СТОП: ffprobe не найден'; exit 2; }
png_ok "$QR" || { echo 'СТОП: QR overlay повреждён — радио не трогаю.'; exit 2; }

if [ -s /etc/andrik-radio.env ]; then
  X="$(grep '^RADIO_CACHE_DIR=' /etc/andrik-radio.env | tail -1 | cut -d= -f2- || true)"
  [ -n "$X" ] && CACHE_DIR="$X"
fi

echo '[1/7] Загружаю R702 из новой сборки…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r702-$(date +%s)" -o "$TMP"
node --check "$TMP" >/dev/null

grep -q 'R702-MP3-HANDOFF-AUTO-FIT-FINAL' "$TMP" || { echo 'СТОП: в источнике ещё не R702.'; exit 3; }
grep -q 'clean-${process.pid}-${Date.now()}-${attempt}.mp3' "$TMP" || { echo 'СТОП: MP3 temp suffix fix отсутствует.'; exit 3; }
grep -q "'-f','mp3',cleanTmp" "$TMP" || { echo 'СТОП: явный MP3 muxer fix отсутствует.'; exit 3; }
grep -q 'ensureNextTrackReadyR702' "$TMP" || { echo 'СТОП: preload следующего MP3 отсутствует.'; exit 3; }
grep -q 'probeVideoDurationR702' "$TMP" || { echo 'СТОП: video-duration guard отсутствует.'; exit 3; }
grep -q 'lastVideoFrameAt' "$TMP" || { echo 'СТОП: video-frame watchdog отсутствует.'; exit 3; }
grep -q 'startSilenceBridgeR702' "$TMP" || { echo 'СТОП: audio bridge отсутствует.'; exit 3; }
grep -q 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos' "$TMP" || { echo 'СТОП: AUTO FIT отсутствует.'; exit 3; }
grep -q 'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black' "$TMP" || { echo 'СТОП: FIT pad отсутствует.'; exit 3; }
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$TMP"; then
  echo 'СТОП: найден crop/cover — R702 не ставлю.'
  exit 3
fi

echo '[2/7] Убираю только старые временные terminal-guards, которые могли откатывать engine…'
rm -f /etc/systemd/system/andrik-radio.service.d/r702-permanent-guard.conf
rm -f /usr/local/sbin/andrik-radio-r702-guard.py
rm -f "$BASE/radio247/server-r702-known-good.mjs"
mkdir -p "$DROPIN_DIR"
cat > "$ENGINE_DROPIN" <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/node $SERVER
EOF

echo '[3/7] Сохраняю старый engine и ставлю R702…'
cp -a "$SERVER" "$BACKUP"
install -m 0644 "$TMP" "$SERVER"
node --check "$SERVER" >/dev/null

echo '[4/7] Чищу только мусор незавершённых cache jobs и старый фиксированный JOY cache…'
mkdir -p "$CACHE_DIR/audio" "$CACHE_DIR/clips"
find "$CACHE_DIR/audio" -maxdepth 1 -type f \( -name '*.part-*' -o -name '*.clean-*' \) -delete 2>/dev/null || true
rm -f "$CACHE_DIR/clips/joy-of-being-official-2026.mp4" 2>/dev/null || true

echo '[5/7] Один чистый restart…'
systemctl daemon-reload
rollback(){
  echo '⚠️ R702 не подтвердился — возвращаю предыдущий server.mjs.'
  cp -f "$BACKUP" "$SERVER" || true
  rm -f "$ENGINE_DROPIN" || true
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
}
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi

echo '[6/7] Жду постоянный publisher + audio path…'
STATUS=''
OK=0
for i in $(seq 1 30); do
  sleep 2
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | grep -q 'R702-MP3-HANDOFF-AUTO-FIT-FINAL'; then
    if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("publisherRunning") and (d.get("producerRunning") or d.get("audioBridgeRunning")) else 1)' 2>/dev/null; then
      OK=1
      break
    fi
  fi
done
if [ "$OK" != 1 ]; then
  echo 'R702 не стал healthy за 60 секунд.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  journalctl -u "$SERVICE" -n 80 --no-pager || true
  rollback
  exit 5
fi

echo '[7/7] Итоговый status…'
printf '%s\n' "$STATUS" | python3 -m json.tool

echo
echo 'ГОТОВО ✅ R702 активен.'
echo '✅ Исправлен КОРЕНЬ пропажи MP3: временный очищенный файл теперь настоящий .mp3 + explicit -f mp3.'
echo '✅ Следующий MP3 обязан быть локально ДО старта клипа.'
echo '✅ Конец клипа определяется по VIDEO duration + реальному движению frame counter.'
echo '✅ Последний кадр больше не имеет права зависать из-за более длинной audio/container дорожки.'
echo '✅ После клипа сразу: DAY/EVENING/NIGHT → название следующего трека → MP3.'
echo '✅ Один persistent YouTube publisher сохраняется; короткие переходы получает silence audio bridge.'
echo '✅ Любой MP4 загружаешь КАК ЕСТЬ: AUTO FIT 1920×1080, полный кадр, crop OFF, вручную растягивать не надо.'
echo '✅ Старый фиксированный JOY cache удалён один раз; дальше R2-version URL сам обновляет заменённый клип.'

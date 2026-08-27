#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
AGENT_SERVICE=andrik-radio-web-control.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_DIR="$(mktemp -d /tmp/andrik-r703.XXXXXX)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
ENGINE_DROPIN="$DROPIN_DIR/r703-engine.conf"
AGENT_TARGET=/usr/local/sbin/andrik-radio-web
AGENT_LIB=/usr/local/lib/andrik-radio-web-agent-r703.mjs
AUTO_TARGET=/usr/local/sbin/andrik-visual-auto-r703
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
trap 'rm -rf "$TMP_DIR"' EXIT

command -v curl >/dev/null || { echo 'СТОП: curl не найден'; exit 2; }
command -v node >/dev/null || { echo 'СТОП: node не найден'; exit 2; }
command -v ffprobe >/dev/null || { echo 'СТОП: ffprobe не найден'; exit 2; }
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/8] Загружаю R703: engine + 4-slot agent + scheduler…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r703-$(date +%s)" -o "$TMP_DIR/server.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-radio-web-agent-r703.mjs?v=55.00-r703-$(date +%s)" -o "$TMP_DIR/agent.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-visual-auto-r703.sh?v=55.00-r703-$(date +%s)" -o "$TMP_DIR/auto.sh"

node --check "$TMP_DIR/server.mjs" >/dev/null
node --check "$TMP_DIR/agent.mjs" >/dev/null
bash -n "$TMP_DIR/auto.sh"

grep -q 'R703-FOUR-VISUAL-CYCLES-R702-ENGINE' "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R703'; exit 3; }
grep -q "if(hour>=6 && hour<12)return 'morning'" "$TMP_DIR/server.mjs" || { echo 'СТОП: MORNING 06-12 отсутствует'; exit 3; }
grep -q "if(hour>=12 && hour<18)return 'day'" "$TMP_DIR/server.mjs" || { echo 'СТОП: DAY 12-18 отсутствует'; exit 3; }
grep -q "if(hour>=18)return 'evening'" "$TMP_DIR/server.mjs" || { echo 'СТОП: EVENING 18-24 отсутствует'; exit 3; }
grep -q 'R702-MP3' "$TMP_DIR/server.mjs" || true
grep -q 'clean-${process.pid}-${Date.now()}-${attempt}.mp3' "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян R702 MP3 cache fix'; exit 3; }
grep -q 'ensureNextTrackReadyR702' "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян R702 next-MP3 preload'; exit 3; }
grep -q 'startSilenceBridgeR702' "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян R702 audio bridge'; exit 3; }
grep -q 'force_original_aspect_ratio=decrease' "$TMP_DIR/server.mjs" || { echo 'СТОП: AUTO FIT отсутствует'; exit 3; }
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$TMP_DIR/server.mjs"; then
  echo 'СТОП: найден crop/cover — не ставлю.'
  exit 3
fi
grep -q "morning:'stream-morning-master-r703.mp4'" "$TMP_DIR/agent.mjs" || { echo 'СТОП: agent не знает MORNING'; exit 3; }
grep -q 'desired=morning' "$TMP_DIR/auto.sh" || { echo 'СТОП: scheduler не знает MORNING'; exit 3; }

echo '[2/8] Делаю резерв только заменяемых файлов…'
TS="$(date +%Y%m%d-%H%M%S)"
cp -a "$SERVER" "$SERVER.bak-r703-$TS"
[ -s "$AGENT_TARGET" ] && cp -a "$AGENT_TARGET" "$AGENT_TARGET.bak-r703-$TS" || true
[ -s "$AUTO_TARGET" ] && cp -a "$AUTO_TARGET" "$AUTO_TARGET.bak-r703-$TS" || true

echo '[3/8] Ставлю R703 без изменения ключей, pairing и R2…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"
install -m 0755 "$TMP_DIR/agent.mjs" "$AGENT_TARGET"
install -m 0755 "$TMP_DIR/agent.mjs" "$AGENT_LIB"
install -m 0755 "$TMP_DIR/auto.sh" "$AUTO_TARGET"
mkdir -p "$DROPIN_DIR" "$VISUAL_DIR"
rm -f "$DROPIN_DIR/r702-engine.conf"
cat > "$ENGINE_DROPIN" <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/node $SERVER
EOF

echo '[4/8] Перевожу AUTO на один новый 4-периодный timer…'
systemctl disable --now andrik-visual-auto-r656.timer andrik-visual-auto-r658.timer andrik-visual-auto-r659.timer >/dev/null 2>&1 || true
cat >/etc/systemd/system/andrik-visual-auto-r703.service <<'UNIT'
[Unit]
Description=ANDRIK four visual cycles scheduler R703
After=andrik-radio.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/andrik-visual-auto-r703 timer
UNIT
cat >/etc/systemd/system/andrik-visual-auto-r703.timer <<'UNIT'
[Unit]
Description=ANDRIK MORNING DAY EVENING NIGHT scheduler R703
[Timer]
OnBootSec=40s
OnUnitActiveSec=60s
AccuracySec=10s
Persistent=true
Unit=andrik-visual-auto-r703.service
[Install]
WantedBy=timers.target
UNIT

echo '[5/8] Перезапускаю agent и радио…'
systemctl daemon-reload
systemctl enable --now andrik-visual-auto-r703.timer >/dev/null
if systemctl list-unit-files "$AGENT_SERVICE" --no-legend 2>/dev/null | grep -q "$AGENT_SERVICE"; then
  systemctl restart "$AGENT_SERVICE"
fi
systemctl restart "$SERVICE"
sleep 5

# Force current slot now. MORNING safely falls back to DAY until morning MP4 exists.
"$AUTO_TARGET" force || true

echo '[6/8] Проверяю R703 health…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  sleep 2
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | grep -q 'R703-FOUR-VISUAL-CYCLES-R702-ENGINE'; then
    if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("publisherRunning") and (d.get("producerRunning") or d.get("audioBridgeRunning")) else 1)' 2>/dev/null; then
      OK=1; break
    fi
  fi
done
[ "$OK" = 1 ] || { echo 'R703 не стал healthy.'; printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true; journalctl -u "$SERVICE" -n 80 --no-pager || true; exit 5; }

echo '[7/8] Проверяю расписание и доступные masters…'
printf '%s\n' "$STATUS" | python3 -m json.tool
for f in \
  "$VISUAL_DIR/stream-morning-master-r703.mp4" \
  "$VISUAL_DIR/stream-day-master-r620.mp4" \
  "$VISUAL_DIR/stream-evening-master-r620.mp4" \
  "$VISUAL_DIR/stream-night-master-r620.mp4"; do
  if [ -s "$f" ]; then echo "✅ $(basename "$f") · $(du -h "$f" | awk '{print $1}')"; else echo "○ $(basename "$f") · пока не назначен"; fi
done

echo '[8/8] ГОТОВО'
echo '✅ УТРО: 06:00–12:00'
echo '✅ ДЕНЬ: 12:00–18:00'
echo '✅ ВЕЧЕР: 18:00–24:00'
echo '✅ НОЧЬ: 00:00–06:00'
echo '✅ Часовой пояс: Europe/Bratislava'
echo '✅ Пока MORNING MP4 не загружен, утром автоматически используется DAY — эфир не ломается.'
echo '✅ R702 MP3/CLIP handoff engine сохранён.'
echo '✅ MP4 вручную растягивать не надо: AUTO FIT 1920x1080, crop OFF.'

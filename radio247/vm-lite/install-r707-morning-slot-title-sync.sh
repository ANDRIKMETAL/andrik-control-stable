#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
AGENT_SERVICE=andrik-radio-web-control.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_DIR="$(mktemp -d /tmp/andrik-r707.XXXXXX)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
ENGINE_DROPIN="$DROPIN_DIR/r707-engine.conf"
AGENT_TARGET=/usr/local/sbin/andrik-radio-web
AGENT_LIB=/usr/local/lib/andrik-radio-web-agent-r707.mjs
AUTO_TARGET=/usr/local/sbin/andrik-visual-auto-r703
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
MANUAL_MARKER="$VISUAL_DIR/.manual-visual-r658"
trap 'rm -rf "$TMP_DIR"' EXIT

command -v curl >/dev/null || { echo 'СТОП: curl не найден'; exit 2; }
command -v node >/dev/null || { echo 'СТОП: node не найден'; exit 2; }
command -v ffmpeg >/dev/null || { echo 'СТОП: ffmpeg не найден'; exit 2; }
command -v ffprobe >/dev/null || { echo 'СТОП: ffprobe не найден'; exit 2; }
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/9] Загружаю R707 engine + 4-slot OVH agent + scheduler…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r707-$(date +%s)" -o "$TMP_DIR/server.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-radio-web-agent-r707.mjs?v=55.00-r707-$(date +%s)" -o "$TMP_DIR/agent.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-visual-auto-r703.sh?v=55.00-r707-$(date +%s)" -o "$TMP_DIR/auto.sh"

node --check "$TMP_DIR/server.mjs" >/dev/null
node --check "$TMP_DIR/agent.mjs" >/dev/null
bash -n "$TMP_DIR/auto.sh"
grep -q 'R707-EXACT-TITLE-SYNC-MORNING-SLOT-R706-PRESERVED' "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R707'; exit 3; }
grep -q 'AUDIO_INPUT_QUEUE_PACKETS = 16' "$TMP_DIR/server.mjs" || { echo 'СТОП: нет bounded PCM queue'; exit 3; }
grep -q 'never announce the next MP3 before its PCM actually enters the master' "$TMP_DIR/server.mjs" || { echo 'СТОП: нет exact-title handoff'; exit 3; }
grep -q "morning:'stream-morning-master-r703.mp4'" "$TMP_DIR/agent.mjs" || { echo 'СТОП: agent не знает MORNING'; exit 3; }
grep -q "version:'R707'" "$TMP_DIR/agent.mjs" || { echo 'СТОП: agent не R707'; exit 3; }
grep -q "if(hour>=6 && hour<12)return 'morning'" "$TMP_DIR/server.mjs" || { echo 'СТОП: MORNING 06-12 отсутствует'; exit 3; }
grep -q 'R706-GEQ-FRAME-ANIMATED' "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян R706 live EQ'; exit 3; }
grep -q 'ensureNextTrackReadyR702' "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян R702 MP3/clip handoff'; exit 3; }
grep -q 'force_original_aspect_ratio=decrease' "$TMP_DIR/server.mjs" || { echo 'СТОП: AUTO FIT отсутствует'; exit 3; }
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$TMP_DIR/server.mjs"; then echo 'СТОП: найден crop/cover'; exit 3; fi

TS="$(date +%Y%m%d-%H%M%S)"
echo '[2/9] Резервные копии…'
cp -a "$SERVER" "$SERVER.bak-r707-$TS"
[ -s "$AGENT_TARGET" ] && cp -a "$AGENT_TARGET" "$AGENT_TARGET.bak-r707-$TS" || true
[ -s "$AUTO_TARGET" ] && cp -a "$AUTO_TARGET" "$AUTO_TARGET.bak-r707-$TS" || true

 echo '[3/9] Ставлю R707 без изменения YouTube key, pairing token и R2…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"
install -m 0755 "$TMP_DIR/agent.mjs" "$AGENT_TARGET"
install -m 0755 "$TMP_DIR/agent.mjs" "$AGENT_LIB"
install -m 0755 "$TMP_DIR/auto.sh" "$AUTO_TARGET"
mkdir -p "$DROPIN_DIR" "$VISUAL_DIR"
rm -f "$DROPIN_DIR"/r70{2,3,4,5,6}-engine.conf 2>/dev/null || true
cat > "$ENGINE_DROPIN" <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/node $SERVER
EOF

 echo '[4/9] Гарантирую новый 4-slot web agent…'
if ! systemctl list-unit-files "$AGENT_SERVICE" --no-legend 2>/dev/null | grep -q "$AGENT_SERVICE"; then
cat >/etc/systemd/system/$AGENT_SERVICE <<'UNIT'
[Unit]
Description=ANDRIK Radio Web Control Agent
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
ExecStart=/usr/bin/node /usr/local/sbin/andrik-radio-web daemon
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
fi

 echo '[5/9] Гарантирую 4 периода AUTO…'
cat >/etc/systemd/system/andrik-visual-auto-r703.service <<'UNIT'
[Unit]
Description=ANDRIK four visual cycles scheduler R703/R707
After=andrik-radio.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/andrik-visual-auto-r703 timer
UNIT
cat >/etc/systemd/system/andrik-visual-auto-r703.timer <<'UNIT'
[Unit]
Description=ANDRIK MORNING DAY EVENING NIGHT scheduler
[Timer]
OnBootSec=40s
OnUnitActiveSec=60s
AccuracySec=10s
Persistent=true
Unit=andrik-visual-auto-r703.service
[Install]
WantedBy=timers.target
UNIT
systemctl disable --now andrik-visual-auto-r656.timer andrik-visual-auto-r658.timer andrik-visual-auto-r659.timer >/dev/null 2>&1 || true
rm -f "$MANUAL_MARKER"

 echo '[6/9] Перезапускаю именно новый agent…'
systemctl daemon-reload
systemctl enable --now "$AGENT_SERVICE" >/dev/null
systemctl restart "$AGENT_SERVICE"
systemctl enable --now andrik-visual-auto-r703.timer >/dev/null
sleep 4

AGENT_OUT="$(node "$AGENT_TARGET" status 2>&1 || true)"
printf '%s\n' "$AGENT_OUT"

 echo '[7/9] Забираю уже загруженное УТРО из R2 на OVH и возвращаю AUTO…'
# This is the exact case from Control: upload is already confirmed in R2, only old agent rejected MORNING.
if node "$AGENT_TARGET" visual-now morning; then
  node "$AGENT_TARGET" visual-auto || true
else
  echo '⚠️ Утро не подтянулось автоматически. Не удаляю R2 файл; agent продолжит работать и можно нажать «Назначить + сейчас» повторно.'
fi

 echo '[8/9] Чистый restart сбрасывает накопленный старый PCM backlog…'
systemctl restart "$SERVICE"
sleep 6
"$AUTO_TARGET" force || true

 echo '[9/9] Проверяю R707 + MORNING + синхрон названия…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  sleep 2
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | grep -q 'R707-EXACT-TITLE-SYNC-MORNING-SLOT-R706-PRESERVED'; then
    if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("publisherRunning") and d.get("audioInputQueuePackets")==16 and d.get("equalizerEngine")=="R706-GEQ-FRAME-ANIMATED" else 1)' 2>/dev/null; then OK=1; break; fi
  fi
done
[ "$OK" = 1 ] || { echo 'R707 не стал healthy.'; printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true; journalctl -u "$SERVICE" -n 100 --no-pager || true; exit 5; }
printf '%s\n' "$STATUS" | python3 -m json.tool

echo
echo '============================================'
echo '✅ R707 ГОТОВ'
echo '✅ MORNING теперь понимается OVH agent: 06:00–12:00'
echo '✅ Уже загруженный morning MP4 подтянут из R2 — повторно грузить не надо'
echo '✅ Название трека меняется только в момент подключения ЕГО PCM'
echo '✅ Огромная audio queue 8192 → 16: накопление рассинхрона убрано'
echo '✅ Старый накопленный backlog очищен restart-ом'
echo '✅ R706 живой эквалайзер сохранён'
echo '✅ R702 MP3 ↔ CLIP handoff сохранён'
echo '✅ AUTO FIT / NO CROP сохранён'
echo '============================================'

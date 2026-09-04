#!/usr/bin/env bash
set -Eeuo pipefail

ENV=/etc/andrik-radio.env
SERVER=/opt/andrik-radio/radio247/server.mjs
SERVICE=andrik-radio.service
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${ENV}.R914-BEFORE-DUAL-${STAMP}.bak"
STATUS_URL=http://127.0.0.1:8080/status

say(){ printf '%s\n' "$*"; }
fail(){ say "❌ $*" >&2; exit 1; }

say '=== ANDRIK RADIO R914 · DUAL RTMPS 2/2 · R913 PRESERVED ==='
say 'Меняется только RTMPS redundancy: primary + YouTube backup ingest.'
say 'Encoder / RAWVIDEO / audio / handoff / visuals / stream key НЕ переписываются.'
say

[ -s "$ENV" ] || fail "$ENV не найден"
[ -s "$SERVER" ] || fail "$SERVER не найден"
command -v node >/dev/null || fail 'node не найден'
command -v systemctl >/dev/null || fail 'systemctl не найден'
command -v curl >/dev/null || fail 'curl не найден'
command -v python3 >/dev/null || fail 'python3 не найден'

say '1/7 Проверяю текущий radio core и поддержку dual ingest...'
node --check "$SERVER" >/dev/null
grep -q 'DUAL_INGEST_ENABLED_R792' "$SERVER" || fail 'live server не содержит DUAL_INGEST_ENABLED_R792'
grep -q "'-f','tee'" "$SERVER" || fail 'live server не содержит tee dual-output transport'
grep -q 'STREAM_BACKUP_URL' "$SERVER" || fail 'live server не содержит backup RTMPS URL'
grep -q 'rtmpsExpectedConnectionsR792' "$SERVER" || fail 'live server не содержит RTMPS lane diagnostics'
say '✅ Dual RTMPS core уже есть в текущем server.mjs — server.mjs не меняю.'

say '2/7 Проверяю stream key без вывода секрета...'
KEY="$(sed -n 's/^[[:space:]]*\(export[[:space:]]\+\)\?YOUTUBE_STREAM_KEY=//p' "$ENV" | tail -n1 | tr -d '\r')"
[ -n "$KEY" ] || fail 'YOUTUBE_STREAM_KEY пуст — 2/2 включать нельзя'
say "✅ stream key найден (${#KEY} символов; значение скрыто)."

say '3/7 Проверяю текущий статус...'
BEFORE="$(curl -fsS --max-time 5 "$STATUS_URL" 2>/dev/null || true)"
if [ -n "$BEFORE" ]; then
  printf '%s' "$BEFORE" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("BEFORE: RTMPS=%s/%s publisher=%s producer=%s transportHealthy=%s"%(d.get("rtmpsEstablishedConnectionsR792"),d.get("rtmpsExpectedConnectionsR792"),d.get("publisherRunning"),d.get("producerRunning"),d.get("transportHealthy")))' || true
else
  say '⚠️ status сейчас не отвечает; preflight продолжаю по service/env.'
fi

say '4/7 Делаю backup env и включаю dual ingest...'
sudo cp -a "$ENV" "$BACKUP"
sudo python3 - "$ENV" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')
lines=[]
for line in s.splitlines():
    if re.match(r'^\s*(?:export\s+)?YOUTUBE_DUAL_INGEST_R792=', line):
        continue
    lines.append(line)
lines.append('YOUTUBE_DUAL_INGEST_R792=1')
p.write_text('\n'.join(lines)+'\n',encoding='utf-8')
PY
sudo chmod --reference="$BACKUP" "$ENV" 2>/dev/null || true
grep -qE '^[[:space:]]*YOUTUBE_DUAL_INGEST_R792=1[[:space:]]*$' "$ENV" || fail 'не удалось записать YOUTUBE_DUAL_INGEST_R792=1'
say '✅ YOUTUBE_DUAL_INGEST_R792=1'

# Current server intentionally does not auto-create the backup URL when a primary
# STREAM_URL_OVERRIDE is active. If that override is the standard YouTube RTMPS host,
# prepare the backup URL explicitly without ever printing the stream key.
OVERRIDE="$(sed -n 's/^[[:space:]]*\(export[[:space:]]\+\)\?STREAM_URL_OVERRIDE=//p' "$ENV" | tail -n1 | tr -d '\r')"
if [ -z "$OVERRIDE" ]; then
  # Let server.mjs derive b.rtmps.youtube.com from the CURRENT stream key.
  sudo python3 - "$ENV" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1])
lines=[line for line in p.read_text(encoding='utf-8').splitlines() if not re.match(r'^\s*(?:export\s+)?STREAM_BACKUP_URL_OVERRIDE=', line)]
p.write_text('\n'.join(lines)+'\n',encoding='utf-8')
PY
  say '✅ Primary URL штатный; backup ingest будет выведен из текущего stream key.'
elif [ -n "$OVERRIDE" ]; then
  case "$OVERRIDE" in
    rtmps://a.rtmps.youtube.com:*|rtmps://a.rtmps.youtube.com/*)
      sudo python3 - "$ENV" "$KEY" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); key=sys.argv[2]
lines=[]
for line in p.read_text(encoding='utf-8').splitlines():
    if re.match(r'^\s*(?:export\s+)?STREAM_BACKUP_URL_OVERRIDE=', line):
        continue
    lines.append(line)
lines.append(f'STREAM_BACKUP_URL_OVERRIDE=rtmps://b.rtmps.youtube.com:443/live2?backup=1/{key}')
p.write_text('\n'.join(lines)+'\n',encoding='utf-8')
PY
      say '✅ Primary override = YouTube; backup override подготовлен (URL скрыт).'
      ;;
    *)
      say '⚠️ STREAM_URL_OVERRIDE задан не на стандартный YouTube primary RTMPS host.'
      say '   Не подменяю его автоматически. Если backup override не задан, ожидается 1/1.'
      ;;
  esac
fi

say '5/7 Один контролируемый restart радио...'
sudo systemctl daemon-reload
sudo systemctl restart "$SERVICE"

say '6/7 Жду publisher + producer + RTMPS 2/2 (до 120 сек)...'
GOOD=0
LAST=''
for i in $(seq 1 24); do
  sleep 5
  LAST="$(curl -fsS --max-time 4 "$STATUS_URL" 2>/dev/null || true)"
  if [ -z "$LAST" ]; then
    say "[$((i*5))s] status ещё поднимается..."
    continue
  fi
  LINE="$(printf '%s' "$LAST" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("RTMPS=%s/%s publisher=%s producer=%s healthy=%s dual=%s backup=%s"%(d.get("rtmpsEstablishedConnectionsR792",0),d.get("rtmpsExpectedConnectionsR792",0),d.get("publisherRunning"),d.get("producerRunning"),d.get("transportHealthy"),d.get("youtubeDualIngestEnabled"),d.get("youtubeBackupIngestArmed")))' 2>/dev/null || true)"
  say "[$((i*5))s] ${LINE:-status parse pending}"
  OK="$(printf '%s' "$LAST" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(1 if int(d.get("rtmpsEstablishedConnectionsR792",0) or 0)>=2 and int(d.get("rtmpsExpectedConnectionsR792",0) or 0)==2 and d.get("publisherRunning") is True and d.get("producerRunning") is True and d.get("transportHealthy") is True and d.get("youtubeDualIngestEnabled") is True else 0)' 2>/dev/null || echo 0)"
  if [ "$OK" = 1 ]; then GOOD=1; break; fi
done

say '7/7 Итог...'
if [ "$GOOD" = 1 ]; then
  say '✅ R914 ACTIVE — RTMPS 2/2'
  say '✅ Один H.264/AAC master → primary + backup RTMPS'
  say '✅ RAWVIDEO / handoff / visuals / radio logic не менялись'
  say "✅ Backup env: $BACKUP"
  exit 0
fi

say '⚠️ Dual mode включён, но 2/2 не подтвердился за 120 секунд.'
if [ -n "$LAST" ]; then
  printf '%s' "$LAST" | python3 -c 'import json,sys; d=json.load(sys.stdin); keys=["rtmpsEstablishedConnectionsR792","rtmpsExpectedConnectionsR792","youtubeDualIngestEnabled","youtubeBackupIngestArmed","publisherRunning","producerRunning","transportHealthy","lastWarning","lastError"]; [print(f"{k}: {d.get(k)}") for k in keys]' || true
fi
say
say 'ВАЖНО: автоматический второй restart/rollback НЕ делаю, чтобы не дёргать живой эфир.'
say "Если видишь 1/2 — пришли этот экран. Backup env: $BACKUP"
say 'Для ручного безопасного возврата 1/1:'
say "sudo cp -a '$BACKUP' '$ENV' && sudo systemctl restart '$SERVICE'"
exit 2

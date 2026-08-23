#!/usr/bin/env bash
set -Eeuo pipefail

SERVICE="andrik-radio.service"
API="https://andrikmetal.com/api/control"
WAS_ACTIVE=0
ADMIN_KEY="${ADMIN_KEY:-}"

if [ "${EUID}" -ne 0 ]; then
  echo "Запусти через sudo."
  exit 1
fi

if systemctl is-active --quiet "$SERVICE"; then WAS_ACTIVE=1; fi

restore_radio(){
  if [ "$WAS_ACTIVE" -eq 1 ] && ! systemctl is-active --quiet "$SERVICE"; then
    systemctl start "$SERVICE" >/dev/null 2>&1 || true
  fi
}
trap restore_radio EXIT

if [ -z "$ADMIN_KEY" ]; then
  read -rsp "ADMIN_KEY (не сохраняется): " ADMIN_KEY
  echo
fi
if [ -z "$ADMIN_KEY" ]; then
  echo "ADMIN_KEY пустой."
  exit 2
fi

call_api(){
  local path="$1"
  curl -sS --max-time 45 -w '\nHTTP_STATUS:%{http_code}\n' \
    -X POST -H "Authorization: Bearer $ADMIN_KEY" -H 'Accept: application/json' \
    "$API/$path"
}

json_body(){ sed '/^HTTP_STATUS:/d'; }
http_code(){ sed -n 's/^HTTP_STATUS://p' | tail -n1; }

printf '%s\n' '[1/5] Останавливаю encoder, чтобы YouTube разрешил изменить Auto-start…'
systemctl stop "$SERVICE"

printf '%s\n' '[2/5] Жду, пока YouTube увидит stream как inactive…'
for i in $(seq 1 18); do
  sleep 3
  STATUS="$(curl -sS --max-time 12 -H "Authorization: Bearer $ADMIN_KEY" -H 'Accept: application/json' "$API/youtube-live-r565?active=1" || true)"
  STREAM="$(printf '%s' "$STATUS" | sed -n 's/.*"streamStatus":"\([^"]*\)".*/\1/p' | head -n1)"
  LIFE="$(printf '%s' "$STATUS" | sed -n 's/.*"lifeCycleStatus":"\([^"]*\)".*/\1/p' | head -n1)"
  echo "  YouTube: broadcast=${LIFE:-?} stream=${STREAM:-?}"
  [ "${STREAM,,}" != "active" ] && break
done

printf '%s\n' '[3/5] Включаю Auto-start ON и Auto-stop OFF…'
RESP="$(call_api 'youtube-live-r609/auto')"
CODE="$(printf '%s\n' "$RESP" | http_code)"
BODY="$(printf '%s\n' "$RESP" | json_body)"
echo "$BODY"
if [ "$CODE" != "200" ]; then
  if printf '%s' "$BODY" | grep -qi 'youtube-oauth-write-scope-required'; then
    echo
    echo 'Нужно один раз переподключить YouTube Studio с новым разрешением R609:'
    echo 'https://andrikmetal.com/service-admin.html?youtube-reconnect=r609'
    echo 'После подтверждения Google запусти ЭТУ ЖЕ команду ещё раз.'
  else
    echo "YouTube API вернул HTTP $CODE. Радио будет восстановлено автоматически."
  fi
  exit 3
fi

printf '%s\n' '[4/5] Запускаю encoder обратно…'
systemctl start "$SERVICE"
sleep 12

printf '%s\n' '[5/5] Проверяю автостарт; если YouTube ещё ждёт — даю безопасную transition-команду…'
RESP="$(call_api 'youtube-live-r609/start')"
CODE="$(printf '%s\n' "$RESP" | http_code)"
BODY="$(printf '%s\n' "$RESP" | json_body)"
echo "$BODY"

if [ "$CODE" = "200" ]; then
  trap - EXIT
  echo
  echo 'ГОТОВО ✅ Auto-start ON · Auto-stop OFF · эфир запущен/запускается.'
  exit 0
fi

# Auto-start can need up to a minute. Do not kill a healthy encoder just because transition polling timed out.
if systemctl is-active --quiet "$SERVICE"; then
  trap - EXIT
  echo
  echo "Encoder ACTIVE. YouTube ответил HTTP $CODE; подожди до 60 секунд и обнови страницу эфира."
  exit 0
fi

exit 4

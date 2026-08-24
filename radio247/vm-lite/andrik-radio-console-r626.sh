#!/usr/bin/env bash
set -u
SERVICE="andrik-radio.service"
STATUS_URL="http://127.0.0.1:8080/status"
stty sane 2>/dev/null || true

pause(){ printf "\nНажми Enter…"; read -r _ || true; }
line(){ printf '%*s\n' 58 '' | tr ' ' '-'; }
radio_state(){
  printf "Radio service: "; systemctl is-active "$SERVICE" 2>/dev/null || true
  if curl -fsS --max-time 3 "$STATUS_URL" >/tmp/andrik-status-r624.json 2>/dev/null; then
    python3 -c 'import json; d=json.load(open("/tmp/andrik-status-r624.json")); c=d.get("current") or {}; n=d.get("next") or {}; print("producer:",d.get("producerRunning")," publisher:",d.get("publisherRunning")); print("▶ СЕЙЧАС:",c.get("title","?"),"("+c.get("album","?")+")"); print("⏭ ДАЛЬШЕ:",n.get("title","?"),"("+n.get("album","?")+")"); print("audio:",d.get("audioMode","AAC 192k"))' 2>/dev/null || true
  else
    echo "Локальный /status недоступен"
  fi
}
masters(){
  local base="/var/cache/andrik-radio-r622/visuals"
  for f in stream-day-master-r620.mp4 stream-evening-master-r620.mp4 stream-night-master-r620.mp4; do
    printf "%-34s " "$f"
    if [ -s "$base/$f" ]; then
      ffprobe -v error -select_streams v:0 -show_entries stream=width,height,avg_frame_rate -of csv=p=0 "$base/$f" 2>/dev/null || echo "ffprobe error"
    else echo "НЕТ"; fi
  done
}
errors(){ journalctl -u "$SERVICE" --since "30 min ago" --no-pager | grep -Ei 'error|fail|broken|non-monotonic|packet corrupt|dts|pts|timeout|reset|dropping' | tail -80 || true; }
need_youtube(){ command -v andrik-youtube >/dev/null 2>&1 || { echo "Нет andrik-youtube. Выполни installer R624."; return 1; }; }
launch(){ need_youtube || return; echo; echo "🔴 ЗАПУСК СТРИМА БЕЗ YOUTUBE STUDIO"; line; andrik-youtube launch; }
recover(){ need_youtube || return; echo; echo "🛠 ВОССТАНОВЛЕНИЕ ЭФИРА"; line; andrik-youtube recover; }

while true; do
  clear 2>/dev/null || true
  echo "ANDRIK RADIO CONTROL · R626"
  line
  echo "1) 🔴 ЗАПУСТИТЬ СТРИМ — БЕЗ STUDIO"
  echo "2) 🛠 ВОССТАНОВИТЬ СТРИМ"
  echo "3) 📡 СТАТУС RADIO + YOUTUBE"
  echo "4) 🔄 ПЕРЕЗАПУСТИТЬ ENCODER"
  echo "5) ⏹ ЗАВЕРШИТЬ LIVE + ОСТАНОВИТЬ ENCODER"
  echo "6) 🔐 АВТОРИЗАЦИЯ YOUTUBE — ССЫЛКОЙ"
  echo "7) ⚙ AUTO-START ON / AUTO-STOP OFF"
  echo "8) 🎬 ПРОВЕРИТЬ 1080p MASTERS"
  echo "9) 📋 ПОСЛЕДНИЕ ОШИБКИ"
  echo "0) ВЫХОД"
  line
  printf "Выбери: "
  read -r choice || exit 0
  case "$choice" in
    1) launch; pause ;;
    2) recover; pause ;;
    3) radio_state; echo; need_youtube && andrik-youtube status || true; pause ;;
    4) systemctl restart "$SERVICE"; sleep 8; radio_state; pause ;;
    5) need_youtube && andrik-youtube end || systemctl stop "$SERVICE"; pause ;;
    6)
      if need_youtube; then
        echo
        echo "Открой на телефоне:"
        echo "https://andrikmetal.com/youtube-device-auth-admin.html"
        echo
        echo "Вся авторизация Google проходит на сайте. В AWS ничего вводить не надо."
        echo "После зелёной галочки вернись сюда и нажми Enter — попробую забрать токен."
        read -r _ || true
        andrik-youtube sync || true
      fi
      pause ;;
    7) need_youtube && andrik-youtube auto-safe; pause ;;
    8) masters; pause ;;
    9) errors; pause ;;
    0) exit 0 ;;
    *) echo "Нет такого пункта"; sleep 1 ;;
  esac
done

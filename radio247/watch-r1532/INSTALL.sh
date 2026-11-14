#!/usr/bin/env bash
set -euo pipefail

mode="${1:---apply}"
bundle_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$mode" == --check ]]; then
  exec /usr/bin/python3 -I "$bundle_dir/watch.py" check
fi
if [[ "$mode" != --apply && "$mode" != --disable ]]; then
  echo 'Использование: bash INSTALL.sh --check | sudo bash INSTALL.sh --apply | sudo bash INSTALL.sh --disable'
  exit 2
fi
if [[ "$EUID" -ne 0 ]]; then
  echo 'Запусти с sudo.'
  exit 1
fi

watch=andrik-watch-r1532
timer="$watch.timer"
service="$watch.service"
config_dir="/etc/$watch"
program_dir="/usr/local/share/$watch"
unit_dir="/etc/systemd/system"

if [[ "$(cat /proc/1/comm)" != systemd ]]; then
  echo 'Для установки нужен Ubuntu VPS с systemd. Локальную диагностику можно запустить с --check.'
  exit 1
fi
exec 9>"/run/lock/$watch.lock"
flock -x 9
if [[ "$mode" == --disable ]]; then
  systemctl disable --now "$timer"
  systemctl stop "$service"
  echo 'WATCH выключен.'
  exit 0
fi

if [[ ! -x /usr/bin/python3 ]] || ! command -v systemctl >/dev/null; then
  echo 'Нужны штатные Python 3 и systemctl.'
  exit 1
fi
for file in watch.py "$service" "$timer"; do
  [[ -r "$bundle_dir/$file" ]] || { echo "В архиве не найден $file"; exit 1; }
done
/usr/bin/python3 -I -c 'import ast,sys; ast.parse(open(sys.argv[1], encoding="utf-8").read())' "$bundle_dir/watch.py"

if [[ ! -s "$config_dir/token" || -t 0 ]]; then
  printf 'Вставь одноразовый код из «AI Агенты → WATCH» и нажми Enter. Ввод скрыт.\n' >&2
  if [[ -s "$config_dir/token" ]]; then
    echo 'Для повторного подключения введи новый код. Пустой ввод оставит текущий ключ.' >&2
  fi
  IFS= read -rs code || true
  printf '\n' >&2
else
  code=''
fi
if [[ -z "$code" && ! -s "$config_dir/token" ]]; then
  echo 'Код подключения не введён.'
  exit 1
fi

if ! getent passwd andrik-watch >/dev/null; then
  useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin andrik-watch
fi
if [[ "$(id -u andrik-watch)" -eq 0 || "$(id -gn andrik-watch)" != andrik-watch ]]; then
  echo 'Системный пользователь andrik-watch имеет неожиданную конфигурацию.'
  exit 1
fi
install -d -o root -g andrik-watch -m 0750 "$config_dir"
install -d -m 0755 "$program_dir"
if [[ -n "$code" ]]; then
  umask 077
  staged_token="$(mktemp "$config_dir/token.XXXXXXXX")"
  trap 'rm -f -- "$staged_token"' EXIT
  token="$(printf '%s\n' "$code" | /usr/bin/python3 -I "$bundle_dir/watch.py" enroll)"
  unset code
  printf '%s\n' "$token" > "$staged_token"
  chown root:andrik-watch "$staged_token"
  chmod 0640 "$staged_token"
  mv -f -- "$staged_token" "$config_dir/token"
  trap - EXIT
  unset token
fi
install -m 0644 "$bundle_dir/watch.py" "$program_dir/watch.py"
install -m 0644 "$bundle_dir/$service" "$unit_dir/$service"
install -m 0644 "$bundle_dir/$timer" "$unit_dir/$timer"
systemctl daemon-reload
systemctl enable --now "$timer"
if systemctl start "$service"; then
  echo 'WATCH подключён. Открой «AI Агенты» и нажми «Обновить».'
else
  echo 'Таймер WATCH включён. Первый отчёт ещё не принят. Посмотри журнал команды ниже.'
  echo 'sudo journalctl -u andrik-watch-r1532.service -n 25 --no-pager'
  exit 1
fi

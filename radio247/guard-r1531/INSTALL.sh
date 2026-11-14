#!/usr/bin/env bash
set -euo pipefail

mode="${1:---apply}"
bundle_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$mode" == --check ]]; then
  exec python3 -I "$bundle_dir/guard.py" check
fi
if [[ "$mode" != --apply && "$mode" != --disable ]]; then
  echo 'Использование: bash INSTALL.sh --check | sudo bash INSTALL.sh --apply | sudo bash INSTALL.sh --disable'
  exit 2
fi
if [[ "$EUID" -ne 0 ]]; then
  echo 'Запусти с sudo.'
  exit 1
fi

guard=andrik-guard-r1531
timer="$guard.timer"
service="$guard.service"
config_dir="/etc/$guard"
program_dir="/usr/local/share/$guard"
unit_dir="/etc/systemd/system"

if [[ "$(cat /proc/1/comm)" != systemd ]]; then
  echo 'Для установки нужен Ubuntu VPS с systemd. Локальную диагностику можно запустить с --check.'
  exit 1
fi
exec 9>"/run/lock/$guard.lock"
flock -x 9
if [[ "$mode" == --disable ]]; then
  systemctl disable --now "$timer"
  systemctl stop "$service"
  echo 'GUARD выключен.'
  exit 0
fi

if [[ ! -x /usr/bin/python3 ]] || ! command -v systemctl >/dev/null; then
  echo 'Нужны штатные Python 3 и systemctl.'
  exit 1
fi
for file in guard.py "$service" "$timer"; do
  [[ -r "$bundle_dir/$file" ]] || { echo "В архиве не найден $file"; exit 1; }
done
/usr/bin/python3 -I -c 'import ast,sys; ast.parse(open(sys.argv[1], encoding="utf-8").read())' "$bundle_dir/guard.py"

if [[ ! -s "$config_dir/token" || -t 0 ]]; then
  printf 'Вставь одноразовый код из «AI Агенты → GUARD» и нажми Enter. Ввод скрыт.\n' >&2
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

if ! getent passwd andrik-guard >/dev/null; then
  useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin andrik-guard
fi
if [[ "$(id -u andrik-guard)" -eq 0 || "$(id -gn andrik-guard)" != andrik-guard ]]; then
  echo 'Системный пользователь andrik-guard имеет неожиданную конфигурацию.'
  exit 1
fi
install -d -o root -g andrik-guard -m 0750 "$config_dir"
install -d -m 0755 "$program_dir"
if [[ -n "$code" ]]; then
  umask 077
  staged_token="$(mktemp "$config_dir/token.XXXXXXXX")"
  trap 'rm -f -- "$staged_token"' EXIT
  token="$(printf '%s\n' "$code" | /usr/bin/python3 -I "$bundle_dir/guard.py" enroll)"
  unset code
  printf '%s\n' "$token" > "$staged_token"
  chown root:andrik-guard "$staged_token"
  chmod 0640 "$staged_token"
  mv -f -- "$staged_token" "$config_dir/token"
  trap - EXIT
  unset token
fi
install -m 0644 "$bundle_dir/guard.py" "$program_dir/guard.py"
install -m 0644 "$bundle_dir/$service" "$unit_dir/$service"
install -m 0644 "$bundle_dir/$timer" "$unit_dir/$timer"
systemctl daemon-reload
systemctl enable --now "$timer"
if systemctl start "$service"; then
  echo 'GUARD подключён. Открой «AI Агенты» и нажми «Обновить».'
else
  echo 'Таймер GUARD включён. Первый отчёт ещё не принят. Посмотри журнал команды ниже.'
  echo 'sudo journalctl -u andrik-guard-r1531.service -n 25 --no-pager'
  exit 1
fi

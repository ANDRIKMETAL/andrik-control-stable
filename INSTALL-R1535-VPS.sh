#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Нужен sudo'; exit 1; }
ROOT="$(cd "$(dirname "$0")" && pwd)"
for x in guard-r1531/guard.py watch-r1532/watch.py; do
  test -f "$ROOT/$x" || { echo "Не найден $x"; exit 1; }
done
python3 -m py_compile "$ROOT/guard-r1531/guard.py" "$ROOT/watch-r1532/watch.py"
for name in guard-r1531 watch-r1532; do
  test -f "/etc/$([[ $name == guard-r1531 ]] && echo andrik-guard-r1531 || echo andrik-watch-r1532)/token" || { echo "Агент $name ещё не подключён. Сначала выполни его исходный INSTALL.sh"; exit 1; }
done
install -m 0644 "$ROOT/guard-r1531/guard.py" /usr/local/share/andrik-guard-r1531/guard.py
install -m 0644 "$ROOT/watch-r1532/watch.py" /usr/local/share/andrik-watch-r1532/watch.py
install -m 0644 "$ROOT/guard-r1531/andrik-guard-r1531.service" /etc/systemd/system/andrik-guard-r1531.service
systemctl daemon-reload
systemctl start andrik-guard-r1531.service
systemctl start andrik-watch-r1532.service
printf 'R1535 установлена. Радио не перезапускалось.\n'

#!/usr/bin/env bash
set -euo pipefail
mode="${1:---check}"
if [[ "$mode" != "--check" && "$mode" != "--apply" ]]; then
  echo "Использование: sudo bash INSTALL-R1160L.sh [--check|--apply]"; exit 2
fi
bundle_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target=/opt/andrik-radio/radio247/server.mjs
service=andrik-radio.service
expected_base=b0e0e03cd91816d235688010b57cf30b545f31af186c33df5935bbfcf4fb598b
expected_new=ef9f68088c051fcc054e3d5cec78b61776ab2a874f8f42b3d88906da0493d907
command -v node >/dev/null
command -v python3 >/dev/null
command -v systemctl >/dev/null
[[ -f "$target" && ! -L "$target" ]] || { echo "Не найден обычный файл $target"; exit 1; }
[[ -f "$bundle_dir/server.mjs" ]] || { echo "server.mjs должен лежать рядом со скриптом"; exit 1; }
new_hash="$(sha256sum "$bundle_dir/server.mjs" | cut -d' ' -f1)"
[[ "$new_hash" == "$expected_new" ]] || { echo "Контрольная сумма нового файла не совпала"; exit 1; }
node --check "$bundle_dir/server.mjs"
old_hash="$(sha256sum "$target" | cut -d' ' -f1)"
if [[ "$old_hash" == "$expected_new" ]]; then echo "Файл R1160L уже установлен. Повторного перезапуска нет."; exit 0; fi
[[ "$old_hash" == "$expected_base" || "$old_hash" == "4e80076b77b6ede67ee1744e0c95817fa3b32c3ac2b2a9dedca550eb2c76e013" ]] || {
  echo "Текущий server.mjs отличается от проверенных R1160J / R1160K. Установка остановлена; эфир не менялся."
  echo "Пришлите текущий server.mjs и диагностический ZIP для сверки."; exit 1
}
if [[ "$mode" == "--check" ]]; then
  echo "Проверка пройдена. Изменений нет. --apply заменит файл и один раз перезапустит эфир."
  exit 0
fi
[[ "$EUID" -eq 0 ]] || { echo "Запустите с sudo"; exit 1; }
# Explicit --apply is the only mutating mode.
systemctl is-active --quiet "$service" || { echo "Служба не активна; сначала требуется диагностика"; exit 1; }
mkdir -p /opt/andrik-radio/backups
backup_dir="$(mktemp -d /opt/andrik-radio/backups/R1160L-XXXXXXXX)"
chmod 700 "$backup_dir"
cp -a -- "$target" "$backup_dir/server.mjs"
staged="$(mktemp "${target}.R1160L.XXXXXXXX")"
cp -- "$bundle_dir/server.mjs" "$staged"
chmod --reference="$target" "$staged"
chown --reference="$target" "$staged"
node --input-type=module --check < "$staged"
mv -f -- "$staged" "$target"
rollback_failed_install(){
  restore="$(mktemp "${target}.restore.XXXXXXXX")"
  cp -a -- "$backup_dir/server.mjs" "$restore"
  mv -f -- "$restore" "$target"
  systemctl restart "$service" || true
  echo "Запуск R1160L не подтверждён. Исходный файл возвращён: $backup_dir/server.mjs"
  echo "Состояние эфира проверьте сборщиком CHECK-ANDRIK-R1160L.py."
  exit 1
}
echo "Устанавливаю R1160L и перезапускаю службу. Возможен краткий перерыв эфира."
systemctl restart "$service" || rollback_failed_install
healthy=0
for attempt in {1..30}; do
  if systemctl is-active --quiet "$service" && python3 - <<'VERIFY'
import json,urllib.request,sys
try:
 with urllib.request.urlopen('http://127.0.0.1:8080/status',timeout=1) as r:d=json.load(r)
 sys.exit(0 if d.get('auditRevisionR1160L')=='R1160L-MP3-CADENCE-REAL-COUNTERS' else 1)
except Exception:sys.exit(1)
VERIFY
  then healthy=1; break; fi
  sleep 1
done
[[ "$healthy" == 1 ]] || rollback_failed_install
cat > "$backup_dir/ROLLBACK.sh" <<ROLLBACK
#!/usr/bin/env bash
set -euo pipefail
[[ \$EUID -eq 0 ]] || { echo 'Нужен sudo'; exit 1; }
[[ \$(sha256sum '$target' | cut -d' ' -f1) == '$expected_new' ]] || { echo 'Файл уже изменён; автоматический откат остановлен'; exit 1; }
node --check '$backup_dir/server.mjs'
restore=\$(mktemp '${target}.rollback.XXXXXXXX')
cp -a -- '$backup_dir/server.mjs' "\$restore"
mv -f -- "\$restore" '$target'
systemctl restart '$service'
echo 'Исходный файл возвращён. Проверьте эфир.'
ROLLBACK
chmod 700 "$backup_dir/ROLLBACK.sh"
echo "R1160L загружен службой. Это не подтверждает 12-часовую стабильность."
echo "Резервная копия: $backup_dir/server.mjs"
echo "Откат: sudo bash $backup_dir/ROLLBACK.sh"
echo "Теперь запустите CHECK-ANDRIK-R1160L.py и сравните диагностику."

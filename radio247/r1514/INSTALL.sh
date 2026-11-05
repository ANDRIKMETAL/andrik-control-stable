#!/usr/bin/env bash
set -euo pipefail
mode="${1:---check}"
[[ "$mode" == --check || "$mode" == --apply ]] || { echo 'Использование: sudo bash INSTALL.sh --check или --apply'; exit 2; }
bundle_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target=/opt/andrik-radio/radio247/server.mjs
service=andrik-radio.service
command -v node >/dev/null
command -v python3 >/dev/null
[[ -f "$target" && ! -L "$target" ]] || { echo "Не найден обычный файл $target; изменений нет."; exit 1; }
staged="$(mktemp --suffix=.mjs)"
report="$(mktemp)"
trap 'rm -f -- "$staged" "$report"' EXIT
python3 "$bundle_dir/patch_no_one_to_become.py" "$target" "$staged" > "$report"
cat "$report"
if cmp -s -- "$target" "$staged"; then echo 'R1514 уже установлен. Повторного перезапуска нет.'; exit 0; fi
if [[ "$mode" == --check ]]; then
 echo 'Проверка пройдена. --apply сохранит резервную копию и перезапустит радио один раз.'
 echo 'Для видео шестого альбома на сервере нужна уже установленная поддержка R1473 или новее.'
 exit 0
fi
[[ "$EUID" -eq 0 ]] || { echo 'Для применения нужен sudo.'; exit 1; }
python3 - "$report" <<'PY'
import json,sys
r=json.load(open(sys.argv[1]))
if not r['existingVideoSupport']:
 raise SystemExit('Не подтверждена существующая поддержка видео R1473. Изменений нет; нужен актуальный server.mjs для проверки.')
PY
systemctl is-active --quiet "$service" || { echo 'Служба радио не активна; изменений нет.'; exit 1; }
# Confirm that the file did not change while the patch was being prepared.
expected="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["sourceSha256"])' "$report")"
actual="$(sha256sum "$target" | cut -d' ' -f1)"
[[ "$expected" == "$actual" ]] || { echo 'server.mjs изменился во время проверки; изменений нет. Повтори проверку.'; exit 1; }
mkdir -p /opt/andrik-radio/backups
backup_dir="$(mktemp -d /opt/andrik-radio/backups/R1514-XXXXXXXX)"
chmod 700 "$backup_dir"
cp -a -- "$target" "$backup_dir/server.mjs"
cp -- "$report" "$backup_dir/patch-report.json"
install_file="$(mktemp "${target}.R1514.XXXXXXXX")"
cp -- "$staged" "$install_file"
chmod --reference="$target" "$install_file"
chown --reference="$target" "$install_file"
node --input-type=module --check < "$install_file"
mv -f -- "$install_file" "$target"
restore_original(){
 local restore_file
 restore_file="$(mktemp "${target}.restore.XXXXXXXX")"
 cp -a -- "$backup_dir/server.mjs" "$restore_file"
 mv -f -- "$restore_file" "$target"
 systemctl restart "$service" || true
 echo "Новый слот не подтверждён службой. Исходник возвращён. Копия: $backup_dir/server.mjs"
 exit 1
}
echo 'Применяю R1514. Радио перезапустится один раз; возможен краткий перерыв эфира.'
systemctl restart "$service" || restore_original
healthy=0
for attempt in {1..30}; do
 if systemctl is-active --quiet "$service" && python3 - <<'PY'
import json,urllib.request,sys
try:
 with urllib.request.urlopen('http://127.0.0.1:8080/status',timeout=1) as r:d=json.load(r)
 sys.exit(0 if d.get('sixthAlbumSlotR1514')=='no-one-to-become' else 1)
except Exception:sys.exit(1)
PY
 then healthy=1; break; fi
 sleep 1
done
[[ "$healthy" == 1 ]] || restore_original
echo "Готово: R1514 загружен службой. Резервная копия: $backup_dir/server.mjs"
echo 'В настройках сайта выбери для No One to Become изображение или загруженный MP4 и режим «Фоны альбомов».'

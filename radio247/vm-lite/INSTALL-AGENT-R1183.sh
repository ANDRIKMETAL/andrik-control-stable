#!/usr/bin/env bash
set -euo pipefail
mode="${1:---check}"
[[ "$mode" == --check || "$mode" == --apply ]] || { echo 'Нужен --check или --apply'; exit 2; }
bundle_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target=/usr/local/lib/andrik-radio-web-agent-r803.mjs
unit=andrik-radio-web-control.service
source_file="$bundle_dir/andrik-radio-web-agent-r803.mjs"
[[ -f "$target" && ! -L "$target" ]] || { echo 'Не найден установленный web-agent'; exit 1; }
node --check "$source_file"
grep -Fq "AGENT_VERSION_R803='R1183'" "$source_file"
systemctl show "$unit" -p ExecStart --value | grep -Fq "$target" || { echo 'ExecStart web-agent отличается; установка остановлена'; exit 1; }
if cmp -s "$target" "$source_file"; then echo 'Агент R1183 уже установлен'; exit 0; fi
[[ "$mode" == --apply ]] || { echo 'Проверка пройдена. --apply обновит и перезапустит только web-agent.'; exit 0; }
[[ "$EUID" == 0 ]] || { echo 'Нужен sudo'; exit 1; }
mkdir -p /root/ANDRIK-SAFE
backup_dir="$(mktemp -d /root/ANDRIK-SAFE/R1183-agent-XXXXXXXX)"
chmod 700 "$backup_dir"
cp -a "$target" "$backup_dir/agent.mjs"
staged="$(mktemp "${target}.R1183.XXXXXXXX")"
cp "$source_file" "$staged"
chmod --reference="$target" "$staged"
chown --reference="$target" "$staged"
before="$(systemctl show andrik-radio.service -p MainPID --value)"
mv -f "$staged" "$target"
healthy=0
if systemctl restart "$unit"; then
 sleep 2
 if systemctl is-active --quiet "$unit"; then healthy=1; fi
fi
if [[ "$healthy" != 1 ]]; then
 cp -a "$backup_dir/agent.mjs" "$target"
 systemctl restart "$unit" || true
 echo 'Новый агент не запустился, предыдущий файл возвращён'; exit 1
fi
after="$(systemctl show andrik-radio.service -p MainPID --value)"
echo "Агент R1183 установлен. Резервная копия: $backup_dir/agent.mjs"
echo "PID радио до/после: $before / $after"
[[ "$before" == "$after" ]] || { echo 'Во время установки изменился PID радио; проверь диагностику.'; exit 1; }

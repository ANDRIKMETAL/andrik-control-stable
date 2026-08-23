ANDRIK METAL RADIO 24/7 — R568 ORACLE ALWAYS FREE

АРХИТЕКТУРА
R2 MP3 -> Oracle Always Free VM -> FFmpeg -> YouTube RTMPS
Cloudflare Container НЕ используется.
Workers Paid за $5/месяц НЕ нужен для самого радио.

ЧТО УЖЕ ИСПОЛЬЗУЕТСЯ
- актуальный public repo: ANDRIKMETAL/andrik-control-stable
- radio247/server.mjs R567: только MP3 из albums/*, без клипов
- единый 10-секундный STREAM-визуал
- R2 библиотека: https://andrikmetal.com/api/music/downloads

РЕКОМЕНДУЕМАЯ ORACLE VM
- Compute -> Create instance
- Image: Ubuntu 24.04
- Shape: VM.Standard.A1.Flex (Always Free Eligible)
- 2 OCPU / 12 GB RAM, если доступно
- Public IPv4: YES
- Boot volume: стандартный 47-50 GB
- Для стрима нужен только исходящий интернет; наружу порт 8080 открывать не надо.

УСТАНОВКА
1. Загрузить install-andrik-radio.sh на VM.
2. Выполнить:
   sudo bash install-andrik-radio.sh
3. Скрипт сам попросит YouTube Stream Key скрытым вводом.
4. Ключ НЕ отправлять в ChatGPT и НЕ добавлять в public GitHub.

КОМАНДЫ
sudo systemctl status andrik-radio --no-pager
sudo journalctl -u andrik-radio -f
sudo systemctl restart andrik-radio
sudo andrik-radio-update

СМЕНА STREAM KEY
sudo bash change-youtube-key.sh

УДАЛЕНИЕ
sudo bash uninstall-andrik-radio.sh

ВАЖНО
Oracle может временно не иметь свободной Always Free A1 capacity в выбранном home region.
Always Free VM может быть reclaimed как idle, но постоянное FFmpeg-кодирование и сетевой поток обычно создают реальную нагрузку; это не отменяет правил Oracle.

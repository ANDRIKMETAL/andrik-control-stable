ANDRIK METAL RADIO 24/7 — R569 LITE

Главное отличие:
- видео визуала уже заранее H.264;
- во время эфира FFmpeg использует -c:v copy;
- постоянного x264-кодирования НЕТ;
- кодируется только MP3 -> AAC 128 kbps;
- поэтому нагрузка значительно ниже.

Архитектура:
R2 MP3 -> маленькая Linux VM -> FFmpeg -> YouTube RTMPS

Подходит для:
- AWS EC2;
- Scaleway;
- Hetzner/VPS;
- Ubuntu/Debian VM;
- других небольших Linux-серверов.

Установка:
sudo bash install-andrik-radio-lite.sh

Stream Key:
не коммитится в GitHub;
хранится только в /etc/andrik-radio.env.

Команды:
sudo systemctl status andrik-radio --no-pager
sudo journalctl -u andrik-radio -f
sudo systemctl restart andrik-radio
sudo andrik-radio-update

# ANDRIK METAL RADIO 24/7 — R569 LITE

## Что играет
- только MP3 из `albums/*` в R2;
- клипов и Shorts в радио нет;
- очередь перемешивается автоматически;
- новые альбомные MP3 подхватываются автоматически.

## LITE
Визуал заранее подготовлен как:

`assets/audio-visual-loop-r569-h264.mp4`

Во время эфира видео идет:

`-c:v copy`

То есть сервер НЕ кодирует H.264 24/7.
FFmpeg кодирует только аудио MP3 → AAC 128 kbps.

Это существенно легче для маленькой бесплатной/дешевой VM.

## Схема
R2 MP3 → Linux VM → FFmpeg → YouTube RTMPS

Cloudflare Containers не используются.

## Установка
`radio247/vm-lite/install-andrik-radio-lite.sh`

YouTube Stream Key хранится только на VM:
`/etc/andrik-radio.env`

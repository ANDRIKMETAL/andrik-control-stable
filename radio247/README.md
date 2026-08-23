# ANDRIK METAL RADIO 24/7 — R567

Cloudflare Container / Workers Builds, без компьютера.

## Что играет

- все MP3 из `albums/*` в R2 через `https://andrikmetal.com/api/music/downloads`;
- `albums/beyond/*` автоматически попадает в радио сразу после скрытой загрузки 4-го альбома;
- каждый цикл перемешивает весь альбомный каталог;
- для ВСЕХ аудиотреков используется единый 10-секундный зацикленный визуал `assets/audio-visual-loop-r566.webm` (~500 KB);
- на визуале уже есть QR слева и `ANDRIKMETAL` справа;
- поверх аудио добавляется только компактный NOW PLAYING + бегущая строка;

## GitHub / Cloudflare

Репозиторий: `ANDRIKMETAL/andrik-control-stable`

Root directory: `radio247`

Deploy command: `npx wrangler deploy`

Secret: `YOUTUBE_STREAM_KEY`

Status: `https://radio.andrikmetal.com/status`

Live: `https://www.youtube.com/@andrikmetal/live`

## R567
Радио воспроизводит только MP3 из `albums/*` в R2. Клипы и Shorts полностью исключены из очереди. Все треки используют общий 10-секундный зацикленный STREAM-визуал.

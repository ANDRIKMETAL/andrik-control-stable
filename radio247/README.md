# ANDRIK METAL RADIO 24/7 — R568 FREE VM

## Архитектура

R2 MP3 → бесплатная Linux VM → FFmpeg → YouTube RTMPS.

Cloudflare Container больше НЕ используется.
Workers Paid за $5/месяц для радио НЕ нужен.

## Что играет

- все MP3 из `albums/*` через `https://andrikmetal.com/api/music/downloads`;
- `albums/beyond/*` попадёт в очередь автоматически после загрузки 4-го альбома;
- каждый цикл перемешивает весь альбомный каталог;
- клипы и Shorts исключены;
- единый STREAM-визуал: `assets/audio-visual-loop-r566.webm`;
- поверх визуала: NOW PLAYING + альбом + бегущая строка.

## Движок

`server.mjs` — R568, MP3 ONLY.

## Бесплатный запуск

Скрипты лежат в:

`radio247/oracle/`

Главный:
`install-andrik-radio.sh`

Он устанавливает FFmpeg/Node/Git, берет актуальный `main`,
создает systemd-сервис с автоперезапуском и ежедневным обновлением.

YouTube Stream Key хранится только на VM в `/etc/andrik-radio.env`.
Ключ нельзя коммитить в GitHub.

## Важно

Старые файлы Cloudflare Container удалены:
- `wrangler.toml`
- `Dockerfile`
- `src/index.ts`
- зависимость `@cloudflare/containers`

Панель YouTube Control R568 больше не ждёт
`radio.andrikmetal.com/status`; состояние эфира определяется через YouTube API.

# ANDRIK METAL RADIO 24/7 — R565

Готово для Cloudflare Workers Builds без компьютера.

## Что играет

- только MP3 из папок `albums/*` в R2 через `https://andrikmetal.com/api/music/downloads`;
- все альбомные треки перемешиваются заново каждый цикл;
- между песнями автоматически вставляются 4 видео из R2:
  - `clips/joy-of-being-official-2026.mp4`
  - `clips/ya-est-official-2026.mp4`
  - `promo/lyra-trika-2026.mp4`
  - `clips/prosnis-fragment-2026.mp4`
- у MP3 используется встроенная обложка ID3;
- если встроенная обложка не читается — используется общая обложка STREAM;
- поверх аудио выводятся NOW PLAYING, альбом и бегущая строка;
- вертикальные ролики автоматически вписываются в 16:9 с размытым фоном.

## GitHub / Cloudflare без ПК

Репозиторий: `ANDRIKMETAL/andrik-control-stable`

Корневая папка проекта для Workers Builds: `radio247`

Worker: `andrik-radio-247`

Custom Domain: `radio.andrikmetal.com`

Deploy command: `npx wrangler deploy`

Секрет, который нужно добавить в Cloudflare после первого импорта проекта:

`YOUTUBE_STREAM_KEY`

Тип: **Secret**.

После добавления секрета Cloudflare создаст новую версию Worker. Если контейнер до этого стартовал без ключа, он сам завершится и на следующем heartbeat поднимется уже с ключом.

## Проверка

Статус радио:

`https://radio.andrikmetal.com/status`

Сам эфир:

`https://www.youtube.com/@andrikmetal/live`

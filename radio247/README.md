# ANDRIK METAL RADIO 24/7 — R607

## Эфир
- Только MP3 из активных альбомов.
- `albums/ocean/*` и `albums/illusion-of-life/*` исключены из очереди.
- Видеоклипы в эфир не вставляются.
- Очередь перемешивается автоматически.

## Визуал по времени суток
Часовой пояс: `Europe/Bratislava`.

- 08:00–16:59 — `assets/stream-day-r607.mp4`
- 17:00–21:59 — `assets/stream-evening-r607.mp4`
- 22:00–07:59 — `assets/stream-night-r607.mp4`

Смена происходит на границе следующей песни, чтобы не обрывать текущий MP3.

## Оверлей
- Текущий трек остаётся в центральной жёлтой плашке.
- Отдельный `NEXT` справа убран.
- Нижняя бегущая строка сохранена; в ней есть `СЕЙЧАС`, `ДАЛЬШЕ`, платформы и `ANDRIKMETAL.COM`.

## Аудио
MP3 → AAC-LC 48 kHz stereo 160 kbps. Финальный RTMPS-публикатор повторно нормализует аудио перед YouTube.

## Быстрый запуск на уже настроенной VM
```bash
sudo bash /opt/andrik-radio/radio247/vm-lite/start-andrik-radio-r607.sh
```

## Первая установка
```bash
sudo bash /opt/andrik-radio/radio247/vm-lite/install-andrik-radio-lite.sh
```

YouTube Stream Key хранится только на VM в `/etc/andrik-radio.env`.

# ANDRIK METAL RADIO 24/7 — R570 LITE

## Что исправлено
- предыдущая песня отображается в кадре;
- текущая песня отображается по центру;
- следующая песня отображается в кадре;
- добавлена бегущая строка снизу;
- хвост исходного 10-секундного визуала автоматически обрезается на 0.55 с, чтобы убрать чёрный блик при зацикливании;
- MP3 по-прежнему берутся только из `albums/*` в R2.

## Почему это всё ещё LITE
Текстовый оверлей не кодируется 24/7. Для каждой песни заранее создаётся короткий H.264 loop с PREV/NOW/NEXT и тикером, после чего весь трек идёт через `-c:v copy`. Кодируется только MP3 → AAC 128 kbps. Следующий overlay готовится заранее во время текущего трека.

## Схема
R2 MP3 → AWS EC2 → короткий prerender overlay → H.264 copy + AAC → YouTube RTMPS

## Установка
`radio247/vm-lite/install-andrik-radio-lite.sh`

YouTube Stream Key хранится только на VM: `/etc/andrik-radio.env`.


## R571 FIX
- previous label lowered;
- full-track pre-rendered overlay, no ticker reset, no 10s loop blink.


## R575 LONG LOOP FIX
- New user-supplied 3:01.5 visual compressed from ~49 MB to ~5.6 MB (1280x720, H.264).
- The same file is referenced 4 times by concat-demuxer, so the runtime visual is ~12 minutes without storing 4 physical copies.
- No `-stream_loop` on the short visual; ticker filter runs continuously for the whole song.
- Previous and next are aligned on the same row; current track font increased.

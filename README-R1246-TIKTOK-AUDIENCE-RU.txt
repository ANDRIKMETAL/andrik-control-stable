ANDRIK R1246 · TIKTOK LIVE AUDIENCE + GRAPH

Что изменено:
1. radio-tiktok-admin.html: карточка Аудитория LIVE.
2. Показывает текущих зрителей, пик, enterCount и Room ID.
3. Чётко различает: LIVE + 0 зрителей / OFFLINE / нет свежих данных.
4. График аудитории: 30 мин, 2 ч, 8 ч, 24 ч.
5. _worker.js: приватный admin endpoint /api/control/radio-tiktok-r1308/audience.
6. Источник: публичные TikTok web LIVE endpoints; RTMP secret и TikTok cookies не читаются.
7. D1 пишет компактный sample примерно раз в 30 секунд и хранит 48 часов.
8. Если TikTok временно блокирует/меняет public endpoint, Control покажет «Нет данных», а не ложный ноль.

После установки открыть:
https://andrikmetal.com/cache-reset-r1246.html

Важно:
Монитор не является официальным TikTok API и зависит от публичных web LIVE endpoints. Сам стрим от этого монитора не зависит.

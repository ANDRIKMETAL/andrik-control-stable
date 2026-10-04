ANDRIK R1240 — TIKTOK STREAM HUB

Добавлено:
1. В разделе «Радио» появился отдельный пункт «🎵 Стрим TikTok».
2. Новый экран /radio-tiktok-admin.html:
   - показывает реальный статус OVH Radio Agent;
   - показывает Radio Service, YouTube RTMPS, текущий трек и Agent;
   - фиксирует безопасную архитектуру MASTER → YouTube + отдельная TikTok ветка;
   - содержит переходы в TikTok LIVE Studio и аналитику TikTok.
3. TikTok Stream Key намеренно НЕ записывается в HTML/JS/ZIP и не выводится в браузер.
4. Кнопки START / STOP TikTok пока заблокированы: они будут включены только после отдельной серверной реализации publisher/reconnect/watchdog.

ВАЖНО:
- radio247/server.mjs в R1240 НЕ ИЗМЕНЁН.
- Текущий YouTube 24/7, RTMPS 2/2, MP3/клипы, тайминги, аудио и игра R1239 не затронуты.
- Это безопасный первый этап: сначала отдельный UI/контур TikTok, затем серверная ветка.

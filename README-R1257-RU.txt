ANDRIK SITE R1257 — HOST CAMERA/MIC PERMISSIONS-POLICY REAL FIX

База: R1256. Все изменения R1256 и R1255 сохранены.

Исправлено:
1. Найдена реальная причина: /radio-host-admin.html совпадал одновременно со специальным правилом и общим /* в Cloudflare _headers.
2. Общее правило добавляло camera=(), microphone=() и снова блокировало камеру/микрофон, даже когда отдельное правило пыталось их разрешить.
3. Для /radio-host-admin.html и /radio-host-admin теперь применяется явное удаление Permissions-Policy из _headers (! Permissions-Policy).
4. В _worker.js для Host Mode restrictive Permissions-Policy также удаляется вместо добавления второго разрешающего значения. Браузер использует стандартный same-origin доступ и может нормально показать системный запрос Android/Chrome.
5. На всех остальных страницах сайта camera=(), microphone=() остаются запрещёнными.
6. Сохранён R1256 FIX устойчивого шага 3 Commit.
7. Добавлена отдельная очистка cache-reset-r1257.html.

После установки открыть /cache-reset-r1257.html, дождаться «Готово», затем открыть «Режим ведущего».

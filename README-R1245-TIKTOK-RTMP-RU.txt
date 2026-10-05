ANDRIK R1245 — TIKTOK MANUAL RTMP BRIDGE

Что добавлено:
1. В «Радио → Стрим TikTok» появился отдельный защищённый блок «RTMP из TikTok Generator».
2. После создания LIVE-комнаты на Android достаточно вставить полный RTMP URL и нажать «СОХРАНИТЬ».
3. RTMP не пишется в HTML/JS/localStorage и не возвращается обратно в браузер после сохранения.
4. Worker шифрует RTMP AES-GCM и хранит в серверной COMMENTS_DB только ciphertext. Ключ шифрования выводится из серверного admin-secret (или RADIO_TIKTOK_STORAGE_SECRET_R1307, если он задан).
5. Существующий защищённый endpoint /api/radio-agent-r1305/tiktok-bootstrap отдаёт расшифрованный RTMP только авторизованному OVH Radio Agent / R1306 bootstrap.
6. Статус в Control показывает отдельно: SECURE CONTROL «СОХРАНЁН» и OVH CONFIG «ГОТОВО». Сам RTMP нигде не показывается.
7. START/STOP TikTok остаются изолированными от YouTube. YouTube RTMPS не перезапускается.
8. SAFE CROP остаётся прежним: TikTok 720x1280, боковой QR удалён, TikTok-only ticker без ANDRIKMETAL.COM.

Важно:
- RTMP, созданный неофициальным Android Generator, может быть временным и привязанным к конкретной TikTok LIVE-комнате. Для новой комнаты TikTok может выдать новый URL — тогда его надо снова сохранить в Control.
- AUTO 15:00–23:00 управляет только OVH TikTok-веткой; он не создаёт новую LIVE-комнату в TikTok сам.
- Первый импорт на текущем VPS должен подхватить уже установленный R1306 bootstrap (проверяет Control примерно каждые 30 секунд).
- В архив также внесена совместимая поддержка tiktok-ingest-refresh-r1307 в web-agent для будущего обновления агента; для первого импорта при пустом /etc/andrik-radio-tiktok.env она не обязательна.

Очистка после загрузки сайта:
https://andrikmetal.com/cache-reset-r1245.html

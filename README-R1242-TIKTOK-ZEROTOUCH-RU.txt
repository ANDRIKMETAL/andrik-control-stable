ANDRIK R1242 + R1304 — TikTok ZERO-TOUCH

1. TikTok Stream берёт уже сохранённый серверный ingest/stream key автоматически через защищённый канал существующего OVH Radio Agent.
2. Ключ не показывается в браузере и не печатается в логах.
3. OVH сохраняет ingest только в /etc/andrik-radio-tiktok.env с правами 0600.
4. После появления конфигурации создаётся enable-marker и TikTok ветка запускается автоматически, когда текущий YouTube master здоров.
5. YouTube primary/backup, MP3/clip timing и основной master не меняются.
6. TikTok картинка: center crop 608x1080 -> 720x1280, боковые края и QR удалены.

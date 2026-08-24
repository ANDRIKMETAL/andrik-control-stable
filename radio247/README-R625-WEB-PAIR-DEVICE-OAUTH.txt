ANDRIK RADIO R625 — WEB PAIR DEVICE OAUTH

Цель: не вводить длинные Google OAuth Client ID / Client Secret в мобильной AWS-консоли.

Схема:
1. Владелец открывает /youtube-device-pair-admin.html.
2. После owner-session вставляет TV/Device Client ID + Client Secret.
3. Worker сохраняет их в D1 максимум на 15 минут и выдаёт одноразовый 10-символьный код.
4. В AWS: sudo andrik-radio -> пункт 6 -> вводится только короткий код.
5. AWS получает Client ID/Secret один раз, Worker сразу удаляет запись.
6. AWS запускает Google Device OAuth; refresh token после подтверждения хранится только на AWS.

Безопасность:
- создание пары требует owner-session / ADMIN_KEY;
- код одноразовый и живёт 15 минут;
- Client ID/Secret очищаются из формы после создания кода;
- после выдачи AWS запись немедленно удаляется;
- refresh token не проходит через сайт.

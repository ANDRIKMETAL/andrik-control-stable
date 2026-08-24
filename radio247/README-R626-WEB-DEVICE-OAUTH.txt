ANDRIK R626 — WEB DEVICE OAUTH

Цель: полностью убрать зависимость Device OAuth от мобильной AWS-консоли.

Страница владельца:
  /youtube-device-auth-admin.html

Поток:
- сайт запрашивает device_code/user_code у Google;
- пользователь открывает Google по кнопке и подтверждает аккаунт;
- сайт сам polling token endpoint до refresh_token;
- refresh token хранится временно в D1 максимум 30 минут после успеха;
- AWS уже имеет Client ID/Secret от R625 и при launch/status без refresh token автоматически вызывает consume R626;
- пакет удаляется из D1 до возврата AWS;
- после sync refresh token хранится только на AWS /etc/andrik-youtube-device.json mode 0600.

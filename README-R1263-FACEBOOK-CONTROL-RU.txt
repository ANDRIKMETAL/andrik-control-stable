ANDRIK SITE R1263 — FACEBOOK CONTROL SYNC / R1356

Исправлено:
- «СОХРАНИТЬ FACEBOOK» теперь не только шифрует ключ в Secure Control, но и сразу отправляет команду синхронизации на VPS.
- Web-agent атомарно пишет /etc/andrik-radio-facebook.env с правами 0600; ключ не печатается.
- «ЗАПУСТИТЬ FACEBOOK» перед каждым START повторно забирает самый свежий ключ, проверяет отдельный R1356 relay и только потом вызывает локальный /control/facebook-start.
- «ОСТАНОВИТЬ FACEBOOK» останавливает только Facebook FFmpeg; R1356 relay и YouTube master остаются живы.
- Save / Start / Stop НЕ делают restart andrik-radio.service.

После деплоя сайта обнови только VPS web-agent:
cd /папка/сайта/radio247/vm-lite && sudo bash INSTALL-AGENT-R1263-FACEBOOK-SYNC.sh

После этого один раз открой /cache-reset-r1263.html.

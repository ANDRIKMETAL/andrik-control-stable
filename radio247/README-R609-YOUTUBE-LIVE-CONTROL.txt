ANDRIK R609 — YouTube Live Control

Что добавлено:
- OAuth scope youtube.force-ssl для управления YouTube Live.
- Auto-start ON / Auto-stop OFF через YouTube Live Streaming API.
- Безопасный fallback transition в LIVE, если Studio зависла в ожидании.
- AWS-скрипт radio247/vm-lite/youtube-live-auto-r609.sh.

ВАЖНО:
После установки R609 один раз открой Служебное -> YouTube Studio OAuth -> Переподключить YouTube Studio и подтверди Google-доступ.
После этого на AWS достаточно запустить youtube-live-auto-r609.sh. ADMIN_KEY спрашивается скрыто и не сохраняется.

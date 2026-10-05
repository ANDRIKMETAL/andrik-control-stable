ANDRIK SITE R1255 — HOST CAMERA/MIC PERMISSIONS FIX

Исправлено:
- корень проблемы: глобальный Permissions-Policy запрещал camera и microphone на ВСЕХ страницах Control;
- только /radio-host-admin.html теперь получает camera=(self), microphone=(self);
- на остальных страницах камера/микрофон по-прежнему запрещены;
- превью камеры после getUserMedia принудительно запускает video.play();
- кнопка «ПРОВЕРИТЬ РАЗРЕШЕНИЯ» показывает отдельно политику сайта и разрешение Android/Chrome;
- если старая политика осталась в кэше, панель прямо говорит поставить R1255 и очистить кэш.

RADIO R1320 менять из-за этой ошибки не требуется: блокировка была на стороне SITE/HTTP response headers.

ANDRIK R1551 — METRICOOL TRACKER

Основа: ANDRIK-R1550-Install.zip.
Добавлен официальный JavaScript трекер Metricool (hash из предоставленного скриншота) в публичные HTML-страницы.
Изменены только HTML-файлы: comments.html, covers.html, privacy.html, control-home.html, clips.html, index.html, singles.html, terms.html, dreaming-of-lira.html, albums.html, player.html, trika.html, beyond-player.html

Не менялись _worker.js, серверные скрипты, агенты, игра, конфигурация D1 и административные страницы.

ВАЖНО: архив — исходная сборка сайта, а не универсальный VPS-инсталлятор.
Опубликуйте содержимое архива тем же способом, каким вы разворачиваете R1550 (Cloudflare Workers/Pages или текущий пайплайн). Не запускайте INSTALL-R1535-VPS.sh ради Metricool: он относится к агентам.
После публикации откройте сайт в браузере и нажмите Verify в Metricool. Проверка может занять некоторое время.
Если сайт использует строгую CSP, может понадобиться разрешить tracker.metricool.com для script-src и connect-src.

Для проверки после публикации: открыть исходный код страницы и найти tracker.metricool.com/resources/be.js.

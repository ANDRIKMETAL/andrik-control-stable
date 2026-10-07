ANDRIK SITE R1264 — FULLSCREEN BUTTON / YOUTUBE / FACEBOOK / HOST UI

Что изменено:
1. Радио → Управление эфиром
   - «ПЕРЕПОДНЯТЬ ВИДЕО» заменено на «НА ВЕСЬ ЭКРАН».
   - Кнопка вызывает VPS action fullscreen-r1383.
   - На VPS сохраняется проверенный R1383 Global Hard Fullscreen:
     весь видеоряд 1920x1080, SAR 1:1, DAR 16:9, без crop/pad.
   - queue 96, MP3 и Facebook-код helper не переписывает.

2. Радио
   - YouTube-блок «Статистика и платформы» убран из основной вкладки Радио.

3. YouTube
   - Исправлена причина прочерков: на странице отсутствовал root id youtubeRadioR565,
     поэтому youtube-radio-r1047.js завершался сразу и вообще не загружал метрики.
   - При временной ошибке YouTube Data API используются локальные сохранённые
     audience-сэмплы + состояние OVH master/RTMPS.
   - Состояние YouTube теперь показывает «ОТЛИЧНО» или «ПЛОХО» по реальному
     transport/publisher/video/RTMPS fallback, а не «API ВРЕМЕННО НЕДОСТУПЕН».
   - Кнопки «Назад в радио / Открыть LIVE / YouTube авторизация» перенесены
     в самый низ страницы YouTube.

4. Facebook
   - Новое название:
     🔴 HEAVY METAL RADIO — LIVE 24/7 🔥 | Epic Metal • Female Vocals | ANDRIK
   - Описание заменено на новый текст пользователя.

5. Режим ведущего
   - Длинное название песни больше не раздвигает/обрезает нижние параметры.
   - Заголовок и карточка «Сейчас играет» имеют безопасный перенос и clamp.

Установка:
A. Задеплой содержимое архива как обычное обновление сайта.
B. На VPS обнови только web-agent + установи R1383 helper/guard:
   cd /папка/сайта/radio247/vm-lite
   sudo bash INSTALL-AGENT-R1264-FULLSCREEN-CONTROL.sh

ВАЖНО: INSTALL-AGENT-R1264-FULLSCREEN-CONTROL.sh НЕ перезапускает andrik-radio.service.
Он перезапускает только web-agent. Радио перезапустится один раз только если потом
нажать кнопку «НА ВЕСЬ ЭКРАН» в контрольке.

После деплоя один раз открыть:
/cache-reset-r1264.html

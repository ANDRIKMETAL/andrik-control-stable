ANDRIK R989 · LAZY VPS MONITOR + SAFE NEXT MEDIA PICKER
2026-09-09

СОХРАНЕНО:
- существующий сайт/контролька R973 preserved
- MP3→MP3 логика не меняется
- station handoff / audio sync / fullscreen не меняются фронтенд-сборкой
- текущий эфир не требуется останавливать для загрузки сайта

НОВОЕ:
1) R988 ON-DEMAND LOAD
   - отдельная панель «Нагрузка VPS / эфира»
   - CPU общий + модель CPU + vCPU
   - RAM / Swap / Load 1/5/15
   - Visual FFmpeg / Publisher / Radio Node / MP3 decoder / other FFmpeg
   - никаких фоновых замеров, пока панель закрыта
   - при сворачивании страницы опрос останавливается

2) R989 SAFE NEXT MEDIA PICKER
   - карточка «Песен в ротации» открывает альбомы с обложками
   - альбом → список песен → выбор
   - карточка «Клипов» открывает список всех обычных клипов
   - текущий эфир не обрывается
   - уже подготовленный boundary/NEXT не переписывается; выбранный элемент ставится в ближайшую безопасную позицию
   - если выбранный элемент уже NEXT, он остаётся NEXT

VPS:
- ANDRIK-R989-VPS-PATCH.sh устанавливает монитор и патчит agent/server
- installer НЕ перезапускает radio service
- монитор активируется после лёгкого restart web-agent
- queue picker backend активируется при следующем обычном restart andrik-radio.service

ВАЖНО:
R989 специально не меняет fade/guard/sync/station timing. Это отдельный слой управления очередью и наблюдения.

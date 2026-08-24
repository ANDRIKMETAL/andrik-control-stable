ANDRIK Radio R615

AUTO SINGLES:
- radio247/server.mjs получает общий список /api/music/downloads;
- берёт активные albums/*.mp3 плюс singles/*.mp3;
- refresh: 120 seconds, применяется между треками без остановки эфира;
- новый сингл добавляется в оставшуюся shuffle-очередь текущего цикла.

DEDUPE:
- активная альбомная копия имеет приоритет над singles/;
- совпадение определяется по нормализованному title и basename MP3;
- одиночные дубли singles/ также фильтруются;
- уже сыгранная в цикле песня не повторяется после замены single -> album.

R614 timestamp continuity, AAC-LC, cache/prefetch, QR/daypart overlays сохранены.

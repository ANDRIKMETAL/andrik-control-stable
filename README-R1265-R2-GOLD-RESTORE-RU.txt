ANDRIK R1265 · R2 COMPACT GOLD RESTORE
======================================

Что сделано
-----------
1. Существующая кнопка «🚑 GOLD CORE · ВОССТАНОВИТЬ» теперь восстанавливает не старый локальный GOLD-CURRENT, а новый Compact GOLD из приватного Cloudflare R2:
   DR/ANDRIK-GOLD-COMPACT-20261007T193449Z.tar.gz

2. Зафиксирован SHA256:
   3f9fa3ae4835929bd91373df4739feabef5d1791328f7ab2ffd4ea432861184d

3. R2 архив скачивает только спаренный OVH web-agent через защищённый endpoint Worker.

4. До распаковки выполняются:
   - проверка R2 SHA256;
   - локальная SHA256 проверка загруженного архива;
   - проверка допустимых путей в tar;
   - node --check восстановленного server.mjs.

5. Восстанавливаются только деревья, реально включённые в Compact GOLD:
   - /opt/andrik-radio
   - /etc/systemd/system
   - /usr/local/sbin

6. НЕ трогается рабочая медиатека:
   /var/cache/andrik-radio-r622
   Поэтому MP3, clips и visuals не удаляются.

7. Перед распаковкой создаётся защитный снимок текущего server.mjs, unit и основных fullscreen helpers в:
   /root/ANDRIK-SAFE/BEFORE-R1265-R2-GOLD-<timestamp>

8. После восстановления выполняются systemctl daemon-reload, restart andrik-radio.service и проверка active/MainPID.

Безопасная последовательность установки
----------------------------------------
A. Сначала развернуть этот сайт/Worker, чтобы появился endpoint:
   /api/radio-agent-r1265/gold

B. Затем на VPS из установленного дерева ANDRIK выполнить:
   sudo bash /opt/andrik-radio/radio247/vm-lite/INSTALL-AGENT-R1265-R2-GOLD-RESTORE.sh

Установщик перезапускает только web-agent. Радио при установке не перезапускается.

После этого кнопка GOLD CORE требует Agent R1265+. На старом агенте она блокируется, поэтому случайно запустить старый локальный GOLD-CURRENT через новую панель нельзя.

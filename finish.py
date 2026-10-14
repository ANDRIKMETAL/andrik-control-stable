from pathlib import Path
p=Path('/mnt/data/work_r1304')
def repl(file,old,new,required=True):
 t=file.read_text('utf-8')
 if required and old not in t:raise AssertionError((file,old[:100]))
 file.write_text(t.replace(old,new),'utf-8')
# fix button menu css for six stages, keep art prominent
f=p/'assets/lira-3d-r1304.js'
t=f.read_text('utf-8')
t=t.replace('#liraLevelList button:last-child{grid-column:1/-1}', '#liraLevelList{grid-template-columns:repeat(2,minmax(0,1fr))}#liraLevelList button:last-child{grid-column:auto}')
t=t.replace('#liraMenu .lira3d-menu-preview{display:none}', '#liraMenu .lira3d-menu-preview{display:none}') # image remains menu full-bleed background, first splash
# Last chapter subtitle fix
# These copied modules must remain separate to protect original R1301.
# R1304 UI state: format context of 6 worlds; old engine side views physically 3D only.
f.write_text(t,'utf-8')
# Update boot to load new entry; leave old 3D compatibility fallback inactive
boot=(p/'assets/lira-boot-r1303.js').read_text('utf-8')
assert "./lira-3d-r1303.js?v=r1303" in boot
boot=boot.replace("./lira-3d-r1303.js?v=r1303","./lira-3d-r1304.js?v=r1304")
(p/'assets/lira-boot-r1304.js').write_text(boot,'utf-8')
# UI extra translations
pold=(p/'assets/lira-i18n-r1301.js').read_text('utf-8')
phrases="""['Шесть миров','Six worlds'],['Шесть миров одного сна','Six dream worlds'],['Шесть','Six'],['миров','worlds'],
['Сначала 3D: Streets → Portrait → Ruins.','First 3D: Streets → Portrait → Ruins.'],
['Затем боковая 3D-камера: Ocean → Space → Tower.','Then side-view 3D: Ocean → Space → Tower.'],
['Сначала Streets, Portrait и Ruins. После них откроются Ocean, Space и Tower — 3D-аркады с боковой камерой.','First Streets, Portrait and Ruins. Then unlock Ocean, Space and Tower, all in side-view 3D.'],
['Зеркала · тайны памяти и живые картины','Mirrors · memory mysteries and living portraits'],
['Руины · двойной прыжок и Хранитель эпох','Ruins · double jump and the Keeper of Ages'],
['Океан · боковая 3D-камера, глубины и пещера','Ocean · side-view 3D, depths and caverns'],
['Космос · боковая 3D-камера и битва со звездным боссом','Space · side-view 3D and a stellar boss'],
['Башня · боковая 3D-камера, подъём и платформы','Tower · side-view 3D, climbing and platforms'],
['Улицы · враги, босс, мотоциклетная погоня','Streets · enemies, boss and motorcycle chase'],
['Все шесть миров пройдены. Ты пробудился.','All six worlds complete. You have awakened.'],
['Следующий мир уже открыт. Продолжай путь.','The next world is unlocked. Keep going.'],
['Выбери открытый мир кампании. После победы откроется следующий.','Select an unlocked world. Complete it to unlock the next.'],
[' · ЗАКРЫТ',' · LOCKED'],
['ПРОЙДЕНО','COMPLETE'],
['ПОРТРЕТ','PORTRAIT'],['РУИНЫ ЭПОХ','RUINS OF AGES'],['ОКЕАН','OCEAN'],['КОСМОС','SPACE'],['БАШНЯ','TOWER'],['ГОРОД СНА','CITY OF SLEEP'],
"""
needle="const pairs=[\n"
assert needle in pold
pold=pold.replace(needle,needle+phrases)
(p/'assets/lira-i18n-r1304.js').write_text(pold,'utf-8')
# replace HTML boot dependencies
f=p/'dreaming-of-lira.html'
t=f.read_text('utf-8')
for a,b in [('Streets / Ocean / Space / Tower / Ruins','Streets / Portrait / Ruins / Ocean / Space / Tower'),('Шесть миров: Streets, Ocean, Space, Tower, Tetris Labyrinth и Ruins.','Шесть миров: Streets, Portrait, Ruins, Ocean, Space и Tower.'),('/assets/lira-i18n-r1301.js?v=r1303','/assets/lira-i18n-r1304.js?v=r1304'),('/assets/lira-boot-r1303.js?v=r1303','/assets/lira-boot-r1304.js?v=r1304')]:
 assert a in t,a
 t=t.replace(a,b)
t=t.replace('R1303</title>','R1304</title>')
f.write_text(t,'utf-8')
# adjust marketing copy and cache-bust, keep user chosen image
f=p/'index.html'
t=f.read_text('utf-8')
old='Пройди с Лирой шесть миров сна: Streets, Ocean, Space, Tower, Tetris Labyrinth и Ruins. Вернулись Океан, Космос и Башня, а после победы над боссом на улицах тебя ждёт кульминационная мотоциклетная погоня.'
new='Сначала пройди три полноценных 3D-мира: Streets, Portrait и Ruins. После победы в Руинах открываются Ocean, Space и Tower — объёмные 3D-уровни с боковой камерой. Сохраняй прогресс, сражайся с боссами и исследуй миры.'
assert old in t
t=t.replace(old,new).replace('/dreaming-of-lira.html?v=r1303','/dreaming-of-lira.html?v=r1304')
f.write_text(t,'utf-8')
# custom refresh stage, preserve storage and saves
refresh='''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ANDRIK GAME · R1304</title><style>body{background:#0b1321;color:#f0e8d7;font:17px/1.65 system-ui;max-width:650px;margin:8vh auto;padding:24px}a{color:#8fefe0}button{background:#cda66d;color:#141823;border:0;border-radius:8px;font:700 17px system-ui;padding:14px;cursor:pointer}</style></head><body><h1>🎸 Dreaming of Líra · R1304</h1><p id="status">Обновляем только игровые файлы в кэше. Сохранения не затрагиваются.</p><p>RU / EN · Streets → Portrait → Ruins → Ocean → Space → Tower · Только 3D.</p><p><a href="/dreaming-of-lira.html?v=r1304" id="play">Открыть игру →</a></p><script>(async()=>{try{if('caches'in window)for(const name of await caches.keys()){const cache=await caches.open(name);for(const request of await cache.keys()){const u=new URL(request.url);if(u.origin===location.origin&&(u.pathname==='/dreaming-of-lira.html'||/^\\/assets\\/(?:portrait-(?:core-)?r\\d+|lira-(?:3d|boot|i18n|progress)-r\\d+|ruins-core-r\\d+|lyra-hero-r\\d+|city-(?:core|3d)-r\\d+)\\.(?:js|css)$/.test(u.pathname)))await cache.delete(request);}}document.getElementById('status').textContent='Готово! Сохранения и язык не затронуты.';}catch(e){document.getElementById('status').textContent='Очистка кэша недоступна. Открой игру по ссылке ниже.'}})();</script></body></html>'''
(p/'game-refresh-r1304.html').write_text(refresh,'utf-8')
(p/'GAME-R1304-README.txt').write_text('ANDRIK GAME R1304 · 6 3D WORLDS\n1 Streets (free 3D)\n2 Portrait (free 3D)\n3 Ruins (free 3D)\n4 Ocean (side-view Three.js 3D)\n5 Space (side-view Three.js 3D)\n6 Tower (side-view Three.js 3D)\nOriginal R1301 chapter modules are reused for the first three worlds.\nLegacy 2D canvas is never shown; old game core is only used for mechanics of the bonus side-view levels.\nUser preview remains R1303 compact WebP.\nProgress uses new andrik-campaign-r1304 key and preserves original campaign completion when available.\nOnly game and homepage game card changed. No changes to radio/control/Youtube.\n','utf-8')

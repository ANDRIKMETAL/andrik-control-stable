/* ANDRIK R1300 — Two-language 3D interface for Streets, Portrait and Ruins.
   Translates visible text and live objectives, never touches game-state keys or logic. */
(()=>{
'use strict';
const KEY='andrik-game-language-r1300';
let locale='ru';
try{locale=localStorage.getItem(KEY)==='en'?'en':'ru';}catch{}
// Russian source phrase, English translation. The longest matching phrase wins.
const pairs=[
['Сложность','Difficulty'],['Лёгкая','Easy'],['Нормальная','Normal'],['Сложная','Hard'],
['Контрольная точка восстановлена','Checkpoint restored'],['Новая контрольная точка · +75 очков','New checkpoint · +75 points'],
['ГЛАВА ПРОЙДЕНА','CHAPTER COMPLETE'],['Очки','Score'],['Победы','Kills'],['Лучшее комбо','Best combo'],['Падения','Deaths'],['Секреты','Secrets'],['Отбитые снаряды','Projectiles deflected'],['Время','Time'],
['КОМБО','COMBO'],['бонус кристаллов','bonus crystals'],['Ящик разбит! Кристаллы внутри','Crate smashed! Crystals inside'],
['Ловушка! Картина выпустила две тени','Trap! Two shadows escaped from the painting'],
['Тайна портрета: +6 кристаллов, энергия восстановлена','Portrait secret: +6 crystals, energy restored'],
['Тайник в картине: +4 кристалла, +25 HP','Hidden painting stash: +4 crystals, +25 HP'],
['Отражение! +150 очков · +1 кристалл','Parry! +150 points · +1 crystal'],
[' очков',' points'],['Заряд','Charge'],['Сложность: ','Difficulty: '],

['Три мира одного сна.','Three worlds, one dream.'],
['Пройди сквозь иллюзии. Найди пробуждение.','Pass through illusions. Find awakening.'],
['Семь миров одного сна.','Seven worlds, one dream.'],
['Три мира','Three worlds'],['Три мира одного сна','Three worlds, one dream'],
['Войти в сон','Enter the Dream'],['Продолжить сон','Continue Dream'],['Новая игра','New Game'],
['Миры','Chapters'],['Выбрать мир','Select Chapter'],['Открыть миры','Open Chapters'],['Назад','Back'],
['Следующий мир','Next Chapter'],['Следующий мир уже открыт. Продолжай путь.','The next chapter is open. Keep going.'],
['Все три мира пройдены. Ты пробудился.','All three chapters are complete. You have awakened.'],
['Прогресс сохранён. Продолжи, когда будешь готов.','Progress saved. Resume when you are ready.'],
['Выбери открытый мир. Следующий откроется после победы.','Choose an unlocked chapter. Win to unlock the next.'],
['Текущее прохождение будет заменено. Начать с первого мира?','Replace the current playthrough and start from the first chapter?'],
['Сон ещё не окончен. Продолжи с начала этого мира.','The dream is not over. Try this chapter again.'],
['Начать заново','Start Over'],['Попробовать снова','Try Again'],['Продолжить','Continue'],['Отмена','Cancel'],
['Попробуй','Try'],['снова','Again'],['Сон','Dream'],['на паузе','Paused'],['пройден','Complete'],['Новый','New'],['сон?','Dream?'],
['Крестовина — движение и поворот','D-pad — movement and turning'],
['Прогресс сохраняется автоматически в этом браузере.','Progress is saved automatically in this browser.'],
['Для удобной игры поверни телефон горизонтально.','Rotate your phone to landscape for better gameplay.'],
['Поверни телефон горизонтально.','Rotate your phone to landscape.'],
['Кнопка ⛶ включает полный экран.','The ⛶ button enters fullscreen.'],
['Поверни телефон горизонтально, если полный экран недоступен.','Rotate your phone to landscape if fullscreen is unavailable.'],
['новый уровень Лиры','new Lyra level'],['новый уровень','new level'],
['движение и поворот','movement and turning'],['движение','movement'],['прыжок','jump'],['меч / предмет','sword / item'],
['суперудар','super attack'],['пауза','pause'],['высокое','High'],['Высокое','High'],['Экономное','Performance'],['Авто','Auto'],
['Качество графики','Graphics quality'],['Выключить звук','Mute sound'],['Включить звук','Unmute sound'],
['Полный экран недоступен в этом браузере','Fullscreen is not supported by this browser'],['Полный экран','Fullscreen'],
['Суперудар готов','Super attack ready'],['Суперудар: нужно ','Super attack: need '],[' заряда',' energy'],
['Здоровье','Health'],['Звук','Sound'],['Пауза','Pause'],['Язык / Language','Language'],
['Ночной город','Night City'],['СТРИТС · НОЧНОЙ ГОРОД','STREETS · NIGHT CITY'],
['Улицы · исследование, драки и погоня','Streets · exploration, combat and chase'],
['Портрет · зеркала и тайны памяти','Portrait · mirrors and memory secrets'],
['Руины · двойной прыжок и Хранитель эпох','Ruins · double jump and Keeper of Ages'],
['Галерея разбитых лиц','Gallery of Broken Faces'],['Руины эпох','Ruins of Ages'],['РУИНЫ ЭПОХ','RUINS OF AGES'],
['ПОРТРЕТ','PORTRAIT'],['ПУСТОЙ ПОРТРЕТ','THE EMPTY PORTRAIT'],['ХРАНИТЕЛЬ ЭПОХ','KEEPER OF AGES'],
['НОЧНОЙ НАДЗИРАТЕЛЬ','NIGHT ENFORCER'],
['СОН 0','DREAM 0'],['СОН 01/03','DREAM 01/03'],['СОН 02/03','DREAM 02/03'],['СОН 03/03','DREAM 03/03'],
[' · ЗАКРЫТ',' · LOCKED'],['STREETS · НОЧНОЙ ГОРОД','STREETS · NIGHT CITY'],['Войти в город','Enter the City'],['Войти в галерею','Enter the Gallery'],
['Войти в руины','Enter the Ruins'],['Продолжить к Портрету','Continue to Portrait'],
['Продолжить к Руинам','Continue to Ruins'],['Завершить трилогию','Finish the Trilogy'],
['Главное меню','Main Menu'],['Начать уровень заново','Restart Chapter'],['Музыка','Music'],['Эффекты','Effects'],
['Выбери инструментальную музыку с устройства. Файл остаётся в браузере.','Choose instrumental music from your device. The file stays in your browser.'],
['Выбери инструментальную версию «Портрет» с устройства. Файл остаётся в браузере.','Choose an instrumental version of Portrait from your device. The file stays in your browser.'],
['Встроенная атмосфера и эффекты синтезируются локально.','Built-in ambience and effects are generated locally.'],
['Этот аудиофайл не воспроизводится в браузере.','This audio file cannot be played in your browser.'],
['Музыка: ','Music: '],
['ПК: после клика в сцену мышь вращает камеру; без захвата мыши — перетаскивание.','PC: click the scene to control the camera with your mouse; otherwise drag to look around.'],
['Телефон: левый джойстик и правая свободная зона.','Phone: left joystick and the free area on the right.'],
['Кнопка БЕГ переключает скорость; повторный ПРЫЖОК — прыжок в воздухе.','RUN toggles speed; press JUMP again for a double jump.'],
['Два нажатия ГИТАРА — удар двумя руками и удар правой.','Two GUITAR presses deliver a two-hand hit followed by a right strike.'],
['У открытых ворот нажми E или «Действие».','At open gates press E or INTERACT.'],
['Пять областей. Двойной прыжок. Поверни три отражателя, чтобы луч достиг двери, и победи Хранителя. Снаряды автоматонов отражаются гитарой.','Five areas. Double-jump the gaps. Turn three reflectors to guide the beam to the door and defeat the Keeper. Deflect automaton projectiles with the guitar.'],
['Пять залов. Найди три эхо памяти — получи кристаллы и здоровье.','Five chambers. Collect three memory echoes for crystals and health.'],
['Двигайся к золотым воротам. Разворачивай Лиру к противнику. Зеркала вращаются кнопкой действия.','Head to the golden gate. Face enemies before attacking. Rotate mirrors using INTERACT.'],
['Улицы, неоновый перекрёсток, драка в NO CHOICE BAR, мотоциклетная погоня и Ночной надзиратель.','Streets, neon crossroads, a brawl in NO CHOICE BAR, a motorcycle chase and the Night Enforcer.'],
['Найди ключ, включи питание бара и доберись до Портрета.','Find the key, restore power to the bar and reach the Portrait.'],
['Двойной прыжок, бег и два удара гитарой. У подсвеченных объектов нажимай ДЕЙСТВИЕ.','Double jump, sprint and chain two guitar strikes. Use INTERACT near highlighted objects.'],
['WASD / стрелки · мышь: камера · Space ×2: двойной прыжок · Shift: бег · R: рывок · ЛКМ: гитара · ПКМ: нога · Q: крик · E: действие · Esc: пауза',
 'WASD / arrows · mouse: camera · Space ×2: double jump · Shift: run · R: dash · Left click: guitar · Right click: kick · Q: scream · E: interact · Esc: pause'],
['стрелки','arrows'],['мышь: камера','mouse: camera'],['двойной прыжок','double jump'],['бег','run'],['рывок','dash'],
['ЛКМ: гитара','Left click: guitar'],['ПКМ: нога','Right click: kick'],['крик','scream'],['действие','interact'],
['ГИТАРА','GUITAR'],['ПРЫЖОК','JUMP'],['КРИК','SCREAM'],['РЫВОК','DASH'],['НОГА','KICK'],['ДЕЙСТВИЕ','INTERACT'],
['БЕГ ✓','RUN ✓'],['БЕГ','RUN'],['ТУРБО','TURBO'],['ВИД','VIEW'],['ЛИЦО','FACE'],['КОРПУС','TORSO'],['СЗАДИ','BEHIND'],
['Приблизить камеру','Zoom camera in'],['Отдалить камеру','Zoom camera out'],
['Высота обзора: лицо, корпус, полный рост','Camera view: face, torso, full body'],
['Включить бег','Enable running'],['Камера','Camera'],['ЛИРА','LYRA'],['ЭНЕРГИЯ ','ENERGY '],
['Контрольная точка сохранена','Checkpoint saved'],['Возвращение к контрольной точке…','Returning to checkpoint…'],
['УРОВЕНЬ ПРОЙДЕН — CITY OF SLEEP','CHAPTER COMPLETE — STREETS'],
['УРОВЕНЬ ПРОЙДЕН — ПОРТРЕТ','CHAPTER COMPLETE — PORTRAIT'],
['УРОВЕНЬ ПРОЙДЕН — РУИНЫ ЭПОХ','CHAPTER COMPLETE — RUINS'],
['НОЧНОЙ НАДЗИРАТЕЛЬ ПОБЕЖДЁН. ПУТЬ К ПОРТРЕТУ ОТКРЫТ.','THE NIGHT ENFORCER IS DEFEATED. THE WAY FORWARD IS OPEN.'],
['ГОРОД ПРОСЫПАЕТСЯ. ВПЕРЕДИ — ПОРТРЕТ.','THE CITY AWAKENS. THE PORTRAIT AWAITS.'],
['ВРЕМЯ СНОВА ДВИЖЕТСЯ. ХРАНИТЕЛЬ ПОБЕЖДЁН.','TIME FLOWS AGAIN. THE KEEPER IS DEFEATED.'],
['ВРЕМЯ СНОВА ДВИЖЕТСЯ','TIME FLOWS AGAIN'],
['«ТЫ ЛЮБИШЬ НЕ МЕНЯ — ТЫ ЛЮБИШЬ МОЙ СВЕТ».','"YOU DO NOT LOVE ME — YOU LOVE MY LIGHT."'],
['ТЫ ЛЮБИШЬ НЕ МЕНЯ — ТЫ ЛЮБИШЬ МОЙ СВЕТ','YOU DO NOT LOVE ME — YOU LOVE MY LIGHT'],
['Новый путь начат. Найди ключ от переулка.','A new run begins. Find the alley key.'],
['Новый путь начат. Пройди галерею и активируй печать.','A new run begins. Cross the gallery and activate the seal.'],
['ВЫХОД → подойди к свету и нажми ДЕЙСТВИЕ','EXIT → approach the light and press INTERACT'],
['Победи Масочников: ','Defeat the Masked: '],['Победи противников: ','Defeat enemies: '],
['Победи стражей: ','Defeat guardians: '],['Победи оставшихся стражей','Defeat the remaining guardians'],
['Волна ','Wave '],[' врагов ',' enemies '],['Победи двойника','Defeat your double'],
['К воротам · E','Go to the gate · E'],['Ворота открыты · E','Gate open · E'],['Голубая печать · E','Blue seal · E'],
['Проведи свет через 3 зеркала · E','Guide light through 3 mirrors · E'],
['Отражатель ','Reflector '],['Свет достиг маски. Победи двойника.','The light reached the mask. Defeat your double.'],['Зеркало ','Mirror '],[' · положение ',' · position '],
[' · ДЕЙСТВИЕ: повернуть',' · INTERACT: rotate'],['Луч: ','Beam: '],
[' · подойди к отражателю',' · approach the reflector'],['Луч у двери · осталось стражей: ','Beam at door · guardians remaining: '],
['Луч у двери · проход открыт','Beam at door · passage open'],['Луч достиг двери — проход открыт!','Beam reached the door — passage open!'],
['Луч достиг двери. Победи оставшихся стражей.','Beam reached the door. Defeat the remaining guardians.'],
['Поверни три отражателя: луч должен дойти до двери','Rotate three reflectors to guide the beam to the door'],
['Двойной прыжок через пропасти','Double-jump over gaps'],['Перепрыгни разрывы. У ворот — E','Jump the gaps. Press E at the gate'],
['К светящемуся выходу · ДЕЙСТВИЕ','Go to glowing exit · INTERACT'],
['Светящийся выход · Действие','Glowing exit · INTERACT'],
['ЭХО ПАМЯТИ · нажми ДЕЙСТВИЕ','MEMORY ECHO · press INTERACT'],
['Эхо памяти ','Memory echo '],[' · Эхо ',' · Echo '],['Все эхо найдены · энергия восстановлена','All echoes found · energy restored'],
['/3 · +3 кристалла, +20 HP','/3 · +3 crystals, +20 HP'],[' · +',' · +'],
['Хранитель: дождись открытия ядра','Keeper: wait until its core opens'],
['Дождись открытия центра груди','Wait until the chest core opens'],
['Центр груди открыт! Атакуй','Chest core exposed! Attack'],
['Уклоняйся. Крик прерывает замах','Dodge. Screaming interrupts the wind-up'],
['Уклонись от атаки, затем бей, пока надзиратель устал','Dodge the attack, then strike while the Enforcer is stunned'],
['Укрывайся от выстрелов. Крик прерывает замах.','Take cover from gunfire. Scream interrupts the wind-up.'],
['Атака прервана. Центр открыт!','Attack interrupted. Core exposed!'],
['Выстрел отражён!','Shot deflected!'],['ГИТАРА: СНАРЯД ОТБИТ!','GUITAR: PROJECTILE DEFLECTED!'],
['Снаряд отражён · 35 урона','Projectile deflected · 35 damage'],
['Музыкальный автомат','Jukebox'],['Найди и включи музыкальный автомат','Find and switch on the jukebox'],
['Включи питание: ','Restore power: '],['Щит питания A','Power switch A'],['Щит питания B','Power switch B'],
['Ключ от переулка','Alley key'],['Найди ключ в боковом переулке','Find the key in the side alley'],
['Неоновый перекрёсток','Neon crossroads'],['Улица пробуждения','Awakening Street'],
['Мотоциклетная погоня','Motorcycle chase'],['Погоня: влево / вправо — руль, назад — тормоз','Chase: left/right to steer, back to brake'],
['Подойди к мотоциклу · ДЕЙСТВИЕ','Approach the motorcycle · INTERACT'],
['Сесть на мотоцикл','Ride the motorcycle'],['Финиш! +8 кристаллов · ДЕЙСТВИЕ — продолжить','Finish! +8 crystals · INTERACT to continue'],
['Финиш! ДЕЙСТВИЕ — слезть и продолжить','Finish! INTERACT to dismount and continue'],
['СТАРТ ЧЕРЕЗ ','START IN '],['Погоня · ','Chase · '],['% · БЕГ / Shift: ускорение · назад: тормоз','% · RUN / Shift: accelerate · back: brake'],
['Зал масок','Hall of Masks'],['Зеркальный лабиринт','Mirror Maze'],['Коридор портретов','Portrait Corridor'],
['Пустой портрет','Empty Portrait'],['Разрушенная башня','Ruined Tower'],
['Стражи песков','Sand Guardians'],['Три механизма эпох','Three Mechanisms of Ages'],
['Мосты над бездной','Bridges over the Abyss'],['Врата забытого времени','Gates of Forgotten Time'],
['Хранитель эпох','Keeper of Ages'],[' повернут · ',' rotated · '],
['Сон 01','Dream 01'],['Сон 02','Dream 02'],['Сон 03','Dream 03'],
['Не загружено игровое ядро','Game engine could not load'],
['Трёхмерный мир Dreaming of Líra','3D World of Dreaming of Líra'],
['. Вернись в меню и повтори. Ошибка: ','. Return to the menu and try again. Error: '],
['Подойди к мотоциклу · садись','Approach the motorcycle · get on'],
['Укрытия · B — граната ×','Cover · B — grenade ×'],
['Браузер потерял WebGL-контекст. Прогресс сохранён. Нажми повторный запуск.','The browser lost its WebGL context. Progress is saved. Press Retry.'],
['Надзиратель устал — атакуй!','Enforcer is stunned — attack!'],
['Дверь открыта — иди к голубому свету','Door is open — follow the blue light'],
[' · готово · +',' · complete · +'],
[' повёрнут · ',' rotated · '],
['Ночной надзиратель','Night Enforcer'],
['Не удалось сохранить: память браузера недоступна','Could not save: browser storage is unavailable'],
[' +',' +'],[' Кристалл',' Crystal'],[' кристалла',' crystals'],[' здоровья',' health'],
['ЭНЕРГИЯ','ENERGY'],['Эхо','Echo'],['СЧЁТ','SCORE'],['НОЧНОЙ ГОРОД','NIGHT CITY']
];
// Preserve product / chapter names that originate in English for Russian interface.
const englishToRussian=[
['STREETS · CITY OF SLEEP','СТРИТС · ГОРОД СНА'],
['STREETS · NIGHT CITY','СТРИТС · НОЧНОЙ ГОРОД'],
['CITY OF SLEEP','ГОРОД СНА'],['STREETS','СТРИТС'],['PORTRAIT','ПОРТРЕТ'],['RUINS','РУИНЫ'],
['THE THREE DREAMS','ТРИ СНА'],['AUTO','АВТО']
];
const replacePairs=[...pairs].filter(x=>x[0]&&x[1]).sort((a,b)=>b[0].length-a[0].length);
const russianPairs=englishToRussian.sort((a,b)=>b[0].length-a[0].length);
const nodes=new WeakMap(), attrs=new WeakMap();const watched=new WeakSet();
function translate(source){
 if(typeof source!=='string'||!source.trim())return source;
 let out=source;
 if(locale==='en'){
   for(const [from,to] of replacePairs)if(out.includes(from))out=out.split(from).join(to);
   return out;
 }
 for(const [from,to] of russianPairs)if(out.includes(from))out=out.split(from).join(to);
 return out;
}
function updateText(n){
 const current=n.nodeValue||'';const previous=nodes.get(n);
 const source=previous&&current===previous.rendered?previous.source:current;
 const translated=translate(source);
 nodes.set(n,{source,rendered:translated});
 if(translated!==current)n.nodeValue=translated;
}
const attrNames=['title','aria-label','placeholder'];
function updateAttrs(el){
 if(!el?.getAttribute)return;
 let record=attrs.get(el);if(!record){record={};attrs.set(el,record);}
 for(const name of attrNames){const current=el.getAttribute(name);if(current===null)continue;
 const entry=record[name];const source=entry&&current===entry.rendered?entry.source:current;
 const translated=translate(source);record[name]={source,rendered:translated};
 if(current!==translated)el.setAttribute(name,translated);
 }
}
function scan(start){
 if(!start)return;
 if(start.nodeType===3){updateText(start);return;}
 if(start.nodeType!==1&&start.nodeType!==9&&start.nodeType!==11)return;
 if(start.nodeType===1){if(['SCRIPT','STYLE','NOSCRIPT'].includes(start.tagName))return;updateAttrs(start);}
 const walker=document.createTreeWalker(start,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
 let n;while((n=walker.nextNode())){
 if(n.nodeType===3&&n.parentElement&&!['SCRIPT','STYLE','NOSCRIPT'].includes(n.parentElement.tagName))updateText(n);
 else if(n.nodeType===1&&!['SCRIPT','STYLE','NOSCRIPT'].includes(n.tagName))updateAttrs(n);
 }
}
const roots=new Set();const observer=new MutationObserver(changes=>{
 for(const change of changes){
 if(change.type==='characterData'){updateText(change.target);continue;}
 if(change.type==='attributes'){updateAttrs(change.target);continue;}
 for(const n of change.addedNodes)scan(n);
 }
});
function refresh(){for(const root of [...roots]){if(!root.isConnected){roots.delete(root);continue;}scan(root);}document.documentElement.lang=locale;
 document.querySelectorAll('#liraLang,#pt-lang').forEach(sel=>{if(sel.value!==locale)sel.value=locale;});}
function set(code){locale=code==='en'?'en':'ru';try{localStorage.setItem(KEY,locale);}catch{}
 refresh();window.dispatchEvent(new CustomEvent('andrik-language-change',{detail:{locale}}));}
function watch(root){if(!root||watched.has(root))return;watched.add(root);roots.add(root);scan(root);observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attrNames});}
window.AndrikI18n={get locale(){return locale;},set,watch,refresh,translate};
document.documentElement.lang=locale;
})();

from pathlib import Path
p=Path('/mnt/data/work_r1304/assets/lira-3d-r1303.js')
s=p.read_text('utf-8')
start=s.index("const campaignOrder=")
stop=s.index("const cinematicArt=",start)
replacement=r'''// R1304: three independent 3D adventures, followed by three side-view 3D worlds.
const campaignOrder=[1,'portrait',6,2,3,4],campaignKey='andrik-campaign-r1304';
const chapterNumber=id=>campaignOrder.indexOf(id)+1;
const bonusWorld=id=>id===2||id===3||id===4;
let portraitActive=false,campaign,activeBonus=false;
function savedJson(key){try{return JSON.parse(localStorage.getItem(key))||null;}catch{return null;}}
const priorThree=savedJson('andrik-campaign-r1280');
const priorSix=savedJson('andrik-campaign-r1302');
const oldSave=savedJson('dreaming-of-lira-save');
function initialCampaign(){
 const unlocked=[1],completed=[];
 // Preserve actual cleared original 3D chapters, not inferred progress from the old side-view campaign.
 for(const id of ['portrait',6]){
   if(priorThree?.unlocked?.includes(id)||priorThree?.completed?.includes(id))unlocked.push(id);
   if(priorThree?.completed?.includes(id))completed.push(id);
 }
 if(priorThree?.completed?.includes(1))completed.push(1);
 const all3=[1,'portrait',6].every(id=>completed.includes(id));
 if(all3){
   unlocked.push(2);
   // Keep side-view progress, but never substitute the old levels for Portrait / Ruins.
   const oldMax=Math.max(1,Number(oldSave?.unlockedLevel)||1);
   if(oldMax>=3)unlocked.push(3);
   if(oldMax>=4)unlocked.push(4);
 }
 return {unlocked:[...new Set(unlocked)],completed:[...new Set(completed)],last:all3?2:unlocked[unlocked.length-1]};
}
campaign=savedJson(campaignKey)||initialCampaign();
if(!Array.isArray(campaign.unlocked))campaign.unlocked=[1];
if(!Array.isArray(campaign.completed))campaign.completed=[];
campaign.unlocked=[...new Set(campaign.unlocked.filter(id=>campaignOrder.includes(id)))];
campaign.completed=[...new Set(campaign.completed.filter(id=>campaignOrder.includes(id)))];
if(!campaign.unlocked.includes(1))campaign.unlocked.unshift(1);
if(!campaignOrder.includes(campaign.last))campaign.last=1;
function storeCampaign(){try{localStorage.setItem(campaignKey,JSON.stringify(campaign));}catch{}}
function completeCampaign(id){
 if(!campaignOrder.includes(id))return;
 if(!campaign.completed.includes(id))campaign.completed.push(id);
 const next=campaignOrder[chapterNumber(id)];
 if(next!==undefined&&!campaign.unlocked.includes(next))campaign.unlocked.push(next);
 storeCampaign();
}
function returnToChapters(){
 portraitActive=false;activeBonus=false;game.sound(sound);game.levels();menuMode='';
 document.body.classList.add('menu-open');
}
async function launch3DChapter(id,fresh=false){
 if(portraitActive)return;
 if(!game.snapshot().started)game.start();
 game.hold();game.clearInput();game.sound(false);
 portraitActive=true;activeBonus=false;document.body.classList.remove('menu-open');
 try{
  const url=id===1?'./city-3d-r1301.js?v=r1304':'./portrait-r1301.js?v=r1304';
  const {launchPortrait}=await import(url);
  launchPortrait({fresh,ruins:id===6,onWin:()=>completeCampaign(id),
    onExit(){returnToChapters();},
    onContinue(){
      completeCampaign(id);portraitActive=false;game.sound(sound);
      const next=campaignOrder[chapterNumber(id)];
      if(next===undefined)returnToChapters();else selectCampaign(next);
    }
  });
 }catch(e){
  console.error('R1304 chapter launch',id,e);returnToChapters();
  alert('Не удалось загрузить 3D-мир / Could not launch the 3D chapter: '+(e?.message||String(e)));
 }
}
function selectCampaign(id,fresh=false){
 if(!campaignOrder.includes(id))id=1;
 if(!campaign.unlocked.includes(id))return;
 campaign.last=id;storeCampaign();game.clearInput();
 if(!bonusWorld(id)){launch3DChapter(id,fresh);return;}
 portraitActive=false;activeBonus=true;game.sound(sound);
 // The previous 2D state engine is only physics; all output comes from Three.js.
 game.campaignLevel(id);
 document.body.classList.remove('menu-open');
 menuMode='';
}
function primaryAction(){
 const s=game.snapshot();
 if(menuMode==='levels'){game.leaveLevels();menuMode='';return;}
 if(menuMode==='confirm'){
  confirmNew=false;campaign={unlocked:[1],completed:[],last:1};
  try{localStorage.removeItem(campaignKey);localStorage.removeItem('andrik-city-3d-r1289');localStorage.removeItem('andrik-portrait-r1280');localStorage.removeItem('andrik-ruins-3d-r1285');}catch{}
  storeCampaign();selectCampaign(1,true);return;
 }
 if(s.victory&&activeBonus){
  completeCampaign(campaign.last);
  const next=campaignOrder[chapterNumber(campaign.last)];
  if(next===undefined){returnToChapters();}else selectCampaign(next);
  return;
 }
 if(menuMode==='over'){selectCampaign(campaign.last,true);return;}
 if(s.started&&s.paused&&menuMode==='pause'&&activeBonus){game.start();return;}
 selectCampaign(campaign.last||1,false);
}
const names={1:'STREETS · ГОРОД СНА',portrait:'PORTRAIT · ПОРТРЕТ',6:'RUINS · РУИНЫ ЭПОХ',2:'OCEAN · ОКЕАН',3:'SPACE · КОСМОС',4:'TOWER · БАШНЯ'};
const descriptions={1:'Улицы · враги, босс, мотоциклетная погоня',portrait:'Зеркала · тайны памяти и живые картины',6:'Руины · двойной прыжок и Хранитель эпох',2:'Океан · боковая 3D-камера, глубины и пещера',3:'Космос · боковая 3D-камера и битва со звездным боссом',4:'Башня · боковая 3D-камера, подъём и платформы'};
'''
s=s[:start]+replacement+s[stop:]
# update main menu banner/branding
s=s.replace('ANDRIK · SIX DREAM WORLDS','ANDRIK · THREE 3D CHAPTERS + THREE 3D ARCADES')
s=s.replace('Шесть миров одного сна.<br>Улицы, Океан, Космос, Башня, Лабиринт и Руины ждут Лиру.','Сначала Streets, Portrait и Ruins. После них откроются Ocean, Space и Tower — 3D-аркады с боковой камерой.')
s=s.replace('3D ONLY · 6 DREAM WORLDS · R1303','3D ONLY · SIX WORLDS · R1304')
# header logic
find="syncCampaignFromSnapshot(s);const activeLevel=Math.max(1,Math.min(6,Number(s.level)||campaign.last||1));el('liraChapter').textContent='СОН '+String(Math.max(0,campaignOrder.indexOf(activeLevel))+1).padStart(2,'0')+' / 06';el('liraLevel').textContent=names[activeLevel]||names[1];"
rep="const activeLevel=campaign.last;el('liraChapter').textContent='СОН '+String(Math.max(1,chapterNumber(activeLevel))).padStart(2,'0')+' / 06';el('liraLevel').textContent=names[activeLevel]||names[1];"
assert find in s
s=s.replace(find,rep)
# descriptions, game HUD from engine is hidden in independent chapters anyway
s=s.replace('(descriptions[activeLevel]||descriptions[1])','(descriptions[activeLevel]||descriptions[1])')
# on bonus victory, complete once
needle="const next=confirmNew?'confirm':s.levelSelect?'levels':!s.started?'title':s.gameOver?'over':s.victory?'win':s.paused?'pause':'none';"
assert needle in s
s=s.replace(needle,"if(activeBonus&&s.started&&s.victory)completeCampaign(campaign.last);\n"+needle)
s=s.replace("next==='title'?'Dreaming of<em>Líra</em>':next==='pause'?'Сон<em>на паузе</em>':next==='levels'?'Шесть<em>миров</em>'","next==='title'?'Dreaming of<em>Líra</em>':next==='pause'?'Сон<em>на паузе</em>':next==='levels'?'Шесть<em>миров</em>'")
s=s.replace("next==='title'?'Шесть миров одного сна.<br>Вернулись Океан, Космос и Башня — продолжай путь Лиры.'","next==='title'?'Сначала 3D: Streets → Portrait → Ruins.<br>Затем боковая 3D-камера: Ocean → Space → Tower.'")
s=s.replace("'Все миры открыты. Ты прошёл весь сон.'","'Все шесть миров пройдены. Ты пробудился.'")
s=s.replace("Number(s.unlocked||campaign.unlocked.length)<6", "campaign.completed.length<6")
s=s.replace("'После победы на улицах тебя ждёт побег на мотоцикле.'","'После победы над боссом побег на мотоцикле.'")
# menu navigation: keep already unlocked, no rewrite based on old snapshot
start=s.index("if(next==='levels'){const unlocked=")
stop=s.index("\nif(shown&&coarse)",start)
s=s[:start]+"""if(next==='levels'){
 el('liraLevelList').replaceChildren();
 for(const [index,id] of campaignOrder.entries()){
  const b=document.createElement('button');b.className='lira3d-button';
  b.disabled=!campaign.unlocked.includes(id);
  b.innerHTML='<small>СОН '+String(index+1).padStart(2,'0')+(b.disabled?' · ЗАКРЫТ':campaign.completed.includes(id)?' · ✓':'')+'</small>'+names[id];
  b.onclick=()=>{confirmNew=false;selectCampaign(id,false);};
  el('liraLevelList').append(b);
 }
}"""+s[stop:]
# amend handler select worlds
s=s.replace("if(!game.snapshot().started){game.start();game.pause();syncCampaignFromSnapshot(game.snapshot());}game.levels();","if(!game.snapshot().started){game.start();game.pause();}game.levels();")
# on menu outside 3d wrappers R1304- before bonus s levels irrelevant; game currently paused when wrapper exit
# Avoid letting old hidden engine's victory with stale selected stage skip newly opened chapter.
s=s.replace("if(s.victory&&activeBonus){", "if(s.victory&&activeBonus){")
# pause handling when paused from bonus use game.start, however it resumes via old game's toggle
# additional translation handled by new language file
out=Path('/mnt/data/work_r1304/assets/lira-3d-r1304.js');out.write_text(s,'utf-8')
print('REPLACED MODULE',len(s))

#!/usr/bin/env python3
from pathlib import Path
import sys
p=Path(sys.argv[1] if len(sys.argv)>1 else '/opt/andrik-radio/radio247/server.mjs')
s=p.read_text(encoding='utf-8')
if 'R943_QUEUE_PATCH_BEGIN' in s:
    print('R943 queue already present')
    raise SystemExit(0)

def once(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'R943 patch refused: {label} anchor count={n}')
    s=s.replace(old,new,1)

# Plan only at the radio-loop boundary. /status remains read-only.
old="""      if(!queue.length || queueIndex>=queue.length){
        queue=buildQueue();
        queueIndex=0;
      }

      const item=queue[queueIndex];"""
new="""      if(!queue.length || queueIndex>=queue.length){
        queue=buildQueue();
        queueIndex=0;
      }
      planBumperIntoQueueR943();

      const item=queue[queueIndex];"""
once(old,new,'radio-loop-plan')

# A manually planned bumper is a normal queue clip, but must reset the station cadence when it really reaches LIVE.
old="""          lastPlayed=item;
          queueIndex++;
          state.lastError='';"""
new="""          lastPlayed=item;
          queueIndex++;
          if(item?.sourceType==='radio-bumper'&&item?.__manualPlannedR943){
            const slotR943=bumperSlotR724(item);if(slotR943){lastBumperSlotR724=slotR943;state.lastBumperSlot=slotR943;}
            songsSinceBumperR724=0;bumperAfterSongsR724=randomBumperGapR724();state.songsSinceBumper=0;state.nextBumperAfterSongs=bumperAfterSongsR724;
          }
          state.lastError='';"""
once(old,new,'planned-bumper-commit')

# If owner moves the planned bumper lower, do not auto-play a duplicate bumper meanwhile.
old="if(!specialHourlyPlayedR727 && !specialPlayedR726 && !stopping && bumperLibrary.length && songsSinceBumperR724>=bumperAfterSongsR724){"
new="if(!specialHourlyPlayedR727 && !specialPlayedR726 && !stopping && bumperLibrary.length && songsSinceBumperR724>=bumperAfterSongsR724 && !hasPlannedBumperAheadR943()) {"
once(old,new,'auto-bumper-duplicate-guard')

block=r'''
// R943_QUEUE_PATCH_BEGIN
// Manual next-6 queue. It never touches A/V, filters, feeders, fullscreen geometry or RTMPS.
// Important: publicStatus() is READ ONLY; queue planning happens only at a radio-loop boundary.
function queueItemPublicR943(item,index){
  if(!item)return null;
  const id=String(item.__manualPlannedIdR943||primaryIdentity(item)||`${item.type||'media'}:${shortText(item.title||'',80)}`);
  return {index:Number(index||0),id,type:String(item.sourceType||'').startsWith('radio-special')?'special':(item.sourceType==='radio-bumper'?'bumper':(item.type||'track')),title:shortText(item.title||'UNTITLED',120),album:shortText(item.album||'',80),sourceType:shortText(item.sourceType||'',50),duration:Number(item.duration||0)||null};
}
function hasPlannedBumperAheadR943(){
  return queue.some((x,i)=>i>=queueIndex&&x?.sourceType==='radio-bumper'&&x?.__manualPlannedR943===true);
}
function planBumperIntoQueueR943(){
  if(!queue.length||!bumperLibrary.length||hasPlannedBumperAheadR943())return false;
  const remaining=Math.max(0,Number(bumperAfterSongsR724||0)-Number(songsSinceBumperR724||0));
  if(remaining<1||remaining>7)return false;
  const currentCounts=queue[queueIndex]?.type==='track'?1:0;
  const futureTracksNeeded=Math.max(0,remaining-currentCounts);
  // Only materialise it when it is close enough to be useful in the six-item Control window.
  if(futureTracksNeeded>5)return false;
  let insertAt=queueIndex+1;
  if(futureTracksNeeded>0){
    let tracks=0,found=false;
    for(let i=queueIndex+1;i<queue.length;i++){
      if(queue[i]?.type==='track')tracks++;
      if(tracks>=futureTracksNeeded){insertAt=i+1;found=true;break;}
    }
    if(!found)return false;
  }
  const base=peekNextBumperR736();if(!base)return false;
  const bumper={...base,__manualPlannedR943:true,__manualPlannedIdR943:`bumper:${bumperSlotR724(base)||0}:${Date.now()}`};
  queue.splice(Math.max(queueIndex+1,insertAt),0,bumper);state.queueLength=queue.length;return true;
}
function upcomingQueueR943(limit=6){
  if(!queue.length)return [];
  const out=[];
  for(let i=queueIndex+1;i<queue.length&&out.length<limit;i++){const row=queueItemPublicR943(queue[i],i-(queueIndex+1));if(row)out.push(row);}
  if(out.length<limit){for(let i=0;i<queue.length&&out.length<limit;i++){if(i===queueIndex)continue;const row=queueItemPublicR943(queue[i],out.length);if(row&&!out.some(x=>x.id===row.id))out.push(row);}}
  return out.slice(0,limit);
}
function moveUpcomingQueueR943(offset,direction,itemId=''){
  const dir=String(direction||'').toLowerCase();const off=Math.max(0,Math.min(5,Number(offset)||0));const expected=String(itemId||'');
  if(!['up','down'].includes(dir))return {ok:false,error:'invalid-direction',upcoming:upcomingQueueR943(6)};
  const firstFuture=queueIndex+1;let absolute=-1;
  if(expected){
    absolute=queue.findIndex((x,i)=>i>=firstFuture&&String(x?.__manualPlannedIdR943||primaryIdentity(x)||'')===expected);
  }
  if(absolute<firstFuture)absolute=firstFuture+off;
  if(absolute<firstFuture||absolute>=queue.length)return {ok:false,error:'queue-item-not-found',upcoming:upcomingQueueR943(6)};
  const actualId=String(queue[absolute]?.__manualPlannedIdR943||primaryIdentity(queue[absolute])||'');
  if(expected&&actualId!==expected)return {ok:false,error:'stale-queue-item',upcoming:upcomingQueueR943(6)};
  const target=dir==='up'?absolute-1:absolute+1;
  if(target<firstFuture||target>=queue.length)return {ok:false,error:'queue-edge',upcoming:upcomingQueueR943(6)};
  [queue[absolute],queue[target]]=[queue[target],queue[absolute]];state.queueLength=queue.length;
  state.lastManualQueueMoveR943={at:new Date().toISOString(),direction:dir,id:actualId,title:shortText(queue[target]?.title||'',80),from:absolute-firstFuture,to:target-firstFuture};
  return {ok:true,move:state.lastManualQueueMoveR943,upcoming:upcomingQueueR943(6)};
}
// R943_QUEUE_PATCH_END

'''
anchor='function publicStatus(){'
once(anchor,block+anchor,'queue-functions')

old="""    previous:state.previous,
    current:state.current,
    next:state.next,
    startedAt:state.startedAt,"""
new="""    previous:state.previous,
    current:state.current,
    next:state.next,
    upcomingR943:upcomingQueueR943(6),
    upcomingR942:upcomingQueueR943(6),
    lastManualQueueMoveR943:state.lastManualQueueMoveR943||null,
    startedAt:state.startedAt,"""
once(old,new,'public-status-fields')

old="""      else if(url.pathname==='/control/timeline-offset')result=await setTimelineCompensationR739(url.searchParams.get('seconds'));
      else throw new Error('unknown local control');"""
new="""      else if(url.pathname==='/control/timeline-offset')result=await setTimelineCompensationR739(url.searchParams.get('seconds'));
      else if(url.pathname==='/control/queue-move')result=moveUpcomingQueueR943(url.searchParams.get('offset'),url.searchParams.get('direction'),url.searchParams.get('itemId'));
      else throw new Error('unknown local control');"""
once(old,new,'local-control-endpoint')

p.write_text(s,encoding='utf-8')
print('R943 queue patch applied')

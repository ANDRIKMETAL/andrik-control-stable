import {addTowerEntry} from './tower-entry-r1459.js?v=r1465';
export function buildRouteWorld(s,world,zone){
 const platforms=[],links=[],main=[];const add=(x,z,w,d,h=0,extra={})=>{const f={x,z,w,d,h,node:platforms.length,...extra};platforms.push(f);return f};const link=(a,b,jump=true)=>links.push({a:a.node,b:b.node,jump});
 let count=world===3?[19,23,21][zone]:world===4?[27,30,25][zone]:[20,24,22][zone];
 for(let i=0;i<count;i++){
  let x,z,h,w=world===4?5.2:8.5,d=world===4?5.2:6.2;
  if(world===3){x=zone===0?Math.sin(i*.67)*5:zone===1?Math.sin(i*.50)*9:Math.sin(i*.88)*5.5;z=i*(zone===1?7.8:8);h=zone===0?[0,.65,1.3,.65,1.8,2.4,1.7,1.0][i%8]+Math.floor(i/8)*.4:zone===1?(i===0?0:1.2+Math.sin(i*.48)*1.1+i*.10):(i===0?0:Math.min(2.4,i*.4)+Math.sin(i*.7)*.55);}
  else if(world===4){const a=i*(zone===0?.50:zone===1?.61:.43);x=Math.sin(a)*(zone===1?10.5:10);z=Math.cos(a)*(zone===1?10.5:10);h=zone===1?i*.48+[0,.65,1.2,.6,0,-.25][i%6]:i*.65;if(zone===2){x+=i*.18;z+=i*.18;}}
  else{x=zone===0?Math.sin(i*.7)*6:zone===1?Math.sin(i*Math.PI/6)*7.5:Math.cos(i*.6)*7;z=i*6.8;h=zone===0?[0,.45,.9,1.35,.9,.45][i%6]:zone===1?[0,.7,1.4,2.1,1.4,.7][i%6]:[0,.8,1.6,2.4,1.6,.8][i%6];w=zone===1?10:9;d=5.8;}
  if(i===0){x=0;z=0;h=0;w=d=10;}
  const arena=zone===2&&i===count-1;
  if(arena){w=world===3?28:25;d=world===3?26:25;const last=main.at(-1);h=last.h;x=last.x;z=last.z+(world===4?0:8);if(world===4){if(Math.abs(last.x)>=Math.abs(last.z))x+=Math.sign(last.x||1)*(w/2+last.w/2-1);else z+=Math.sign(last.z||1)*(d/2+last.d/2-1);}}
  const f=add(x,z,w,d,Number(h.toFixed(2)),{route:i,main:i,arena});const last=main.at(-1);if(last)link(last,f,true);main.push(f);
 }
 // Wide, visible steps break up the route; the main nodes keep a unique route order.
 for(let i=2;i<count-1;i+=4){const a=main[i-1],b=main[i],dx=b.x-a.x,dz=b.z-a.z,sep=Math.hypot(dx,dz);
  if(world!==4&&sep<9.5&&Math.abs(b.h-a.h)<1.2){const step=add((a.x+b.x)/2,(a.z+b.z)/2,world===4?2.0:4.2,world===4?2.0:3.3,(a.h+b.h)/2,{stair:true,route:i-.5});const index=links.findIndex(e=>e.a===a.node&&e.b===b.node);if(index>=0)links.splice(index,1);link(a,step,Math.abs(step.h-a.h)>.36);link(step,b,Math.abs(b.h-step.h)>.36);}}
 s.geo={length:Math.max(...main.map(f=>f.z))+18,walls:[],platforms};s.routeLinks=links;s.routeMain=main.map(f=>f.node);s.layoutR1457=1;if(world===4)addTowerEntry(s,main);
 const indices=zone===2?[Math.floor(count*.25),Math.floor(count*.53),count-1]:[Math.floor(count*.22),Math.floor(count*.54),count-3];
 const labels=world===3?(zone===0?['Кислород','Питание шлюза','Шлюз']:zone===1?['Капсула экипажа 1','Капсула экипажа 2','Капсула экипажа 3']:['Охлаждение','Щит ангара','Ядро станции']):world===4?['Шестерня рассвета','Маятник','Сердце часов']:['Код 1','Код 2','Код 3'];
 s.switches=indices.map((i,id)=>({...main[i],x:main[i].x-1.2,id,active:false,label:labels[id]}));const last=main.at(-1);s.exit={x:last.x,z:last.z+(zone===2?7:1.5),y:last.h};
 const n=world===3?[11,14,13][zone]:world===4?[9,11,10][zone]:[9,12,11][zone];
 for(let i=0;i<n;i++){const at=2+Math.floor(i*(count-5)/n),f=main[at];const kind=world===3?(i%4===0?'robot':i%3===0?'drone':'astronaut'):(i%3===0?'double':i%2?'shadow':'mask'),e=s.spawn(kind,f.x+(i%2?.9:-.9),f.z);Object.assign(e,{y:f.h,homeY:f.h,navPlatform:f.node,worldRevision:1457,role:world===4?'clockwork':world===5?'construct':kind,cd:1.5+i*.12});}
 if(zone===2){const e=s.spawn('boss',last.x+2,last.z+1);Object.assign(e,{y:last.h,homeY:last.h,hp:world===3?560:460,max:world===3?560:460,worldRevision:1457,bossType:world===3?'warMech':world===4?'clockwork':'architect',name:world===3?'АРЕС · Осадный робот':world===4?'Хозяин времени':'Архитектор сна',hurtRadius:world===3?1.1:.8,arena:last,mode:'chase',cd:2,navPlatform:last.node});s.bossOpen=1;}
 return main;
}

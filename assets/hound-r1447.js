import * as T from './vendor/three-r170.module.min.js';
export function createHound(){
 const root=new T.Group(),body=new T.Group();root.name='Night-hound';root.add(body);
 const fur=new T.MeshStandardMaterial({color:'#28282d',roughness:.94}),tan=new T.MeshStandardMaterial({color:'#695340',roughness:.95}),black=new T.MeshStandardMaterial({color:'#101116',roughness:.70}),eye=new T.MeshStandardMaterial({color:'#e5b96b',emissive:'#aa652b',emissiveIntensity:.30,roughness:.4}),tooth=new T.MeshStandardMaterial({color:'#d4cab4',roughness:.6}),metal=new T.MeshStandardMaterial({color:'#6d7782',roughness:.4,metalness:.6});
 const sphere=new T.SphereGeometry(1,14,10),cone=new T.ConeGeometry(1,1,10);
 const ell=(parent,mat,x,y,z,a,b,c)=>{const o=new T.Mesh(sphere,mat);o.position.set(x,y,z);o.scale.set(a,b,c);o.castShadow=true;parent.add(o);return o;};
 ell(body,fur,0,.60,-.04,.26,.30,.60);ell(body,fur,0,.64,.36,.24,.31,.27);ell(body,tan,0,.44,.29,.17,.20,.25);
 const neck=ell(body,fur,0,.80,.45,.21,.28,.21);neck.rotation.x=.35;
 const head=new T.Group();head.position.set(0,.98,.56);body.add(head);
 ell(head,fur,0,0,0,.19,.20,.24);ell(head,tan,0,-.055,.22,.115,.085,.23);ell(head,black,0,-.03,.42,.092,.065,.055);
 const jaw=new T.Group();jaw.position.set(0,-.10,.12);head.add(jaw);ell(jaw,tan,0,-.02,.12,.105,.055,.22);
 for(const side of [-1,1]){
  ell(head,eye,side*.153,.022,.14,.017,.018,.016);
  const ear=new T.Mesh(cone,fur);ear.position.set(side*.125,.19,-.02);ear.scale.set(.07,.17,.07);ear.rotation.z=-side*.13;head.add(ear);
  const canine=new T.Mesh(cone,tooth);canine.position.set(side*.072,-.08,.27);canine.scale.set(.018,.06,.018);canine.rotation.z=Math.PI;head.add(canine);
 }
 const collar=new T.Mesh(new T.TorusGeometry(.203,.025,6,24),black);collar.position.set(0,.84,.47);collar.rotation.x=.5;body.add(collar);
 ell(body,metal,0,.64,.64,.032,.04,.017);
 const legs=[];
 for(const front of [true,false])for(const side of [-1,1]){
  const leg=new T.Group();leg.position.set(side*.20,.57,front?.35:-.45);body.add(leg);
  ell(leg,fur,0,-.10,0,.075,.21,.095);const shin=new T.Group();shin.position.set(0,-.25,front?0:-.045);leg.add(shin);
  ell(shin,tan,0,-.09,.02,.048,.15,.055);ell(shin,black,0,-.245,.07,.063,.045,.12);legs.push({leg,shin,front,side});
 }
 const tail=new T.Group();tail.position.set(0,.72,-.60);body.add(tail);const tailMesh=ell(tail,fur,0,-.02,-.22,.055,.065,.28);tailMesh.rotation.x=-.32;
 root.userData={isDog:true,body,head,jaw,legs,tail,kind:'dog'};return root;
}
export function poseHound(root,e,time){
 const u=root.userData;root.position.set(e.x,e.y||0,e.z);root.rotation.set(0,e.yaw||0,0);root.visible=e.hp>0||e.dead>0;
 u.body.position.set(0,0,0);u.body.rotation.set(0,0,0);
 const moving=['chase','patrol','retreat'].includes(e.mode),phase=time*(e.mode==='chase'?15:9);
 for(const l of u.legs){const offset=(l.front?1:-1)*l.side,step=moving?Math.sin(phase+offset*Math.PI/2)*.62:0;l.leg.rotation.x=step;l.shin.rotation.x=Math.max(0,-step)*.65;}
 u.head.rotation.set(e.mode==='windup'?-.12:0,0,0);u.tail.rotation.set(-.25,Math.sin(time*8)*.18,0);u.jaw.rotation.x=['windup','strike'].includes(e.mode)?.5:0;
 if(e.mode==='strike')u.body.position.y=Math.sin(Math.min(1,e.t/.38)*Math.PI)*.18;
 if(e.down>0||e.hp<=0){const fall=e.hp<=0?1:Math.min(1,(e.downAge||0)/.24)*Math.min(1,e.down/.38);u.body.rotation.z=fall*1.5;u.body.position.y=.25*fall;u.legs.forEach(l=>l.leg.rotation.x=-.7*fall);}
}

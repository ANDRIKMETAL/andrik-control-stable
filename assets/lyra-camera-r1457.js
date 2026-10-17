export const CAMERA_R1457={distance:3.65,focus:1.46,pitch:.09,shoulder:.68};
export function lyraCamera(p,{yaw=p.yaw,mode=0,distance=3.65,pitch=.09}={}){
 const angle=mode===1?p.yaw+Math.PI:mode===2?p.yaw:yaw,d=mode===1?.78:mode===2?2.15:distance,focus=mode===1?1.76:mode===2?1.1:1.46;
 const shoulder=mode?0:.68,rx=-Math.cos(angle),rz=Math.sin(angle);
 return {yaw:angle,target:{x:p.x+rx*shoulder*.32,y:p.y+focus,z:p.z+rz*shoulder*.32},position:{x:p.x-Math.sin(angle)*d+rx*shoulder,y:p.y+focus+(mode===1?.015:Math.sin(pitch)*d),z:p.z-Math.cos(angle)*d+rz*shoulder}};
}

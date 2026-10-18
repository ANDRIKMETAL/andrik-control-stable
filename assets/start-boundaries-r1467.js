export function addStartBoundary(geo,kind){
 if(geo.startBoundary1467)return geo;
 const city=kind==='city',back={x:0,z:city?-2.45:-2.65,w:city?29:11,d:.70,h:city?8:7,startBoundary:true};
 const walls=[back,...[-1,1].map(side=>({x:side*(city?14.15:5.2),z:city?5.8:1.9,w:.7,d:city?17.2:9.8,h:city?8:5.8,startBoundary:true}))];geo.walls.push(...walls);
 if(!city){const f=geo.platforms[0];f.z=2;f.d=10;}else{const f=geo.platforms.find(f=>!f.objectTop&&f.h===0);if(f){f.d+=2;}}
 geo.startBoundary1467={kind,walls};return geo;
}

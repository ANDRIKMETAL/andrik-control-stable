import * as T from '../assets/vendor/three-r170.module.min.js';
import assert from 'node:assert/strict';
import {detailKit} from '../assets/detail-kit-r1307.js';
import {WorldState} from '../assets/worlds-core-r1306.js';
const geometries=new Set(),materials=new Set(),textures=new Set(),kit=detailKit({geometries,materials,textures});
for(const world of ['city','portrait','ruins',2,3,4,5]){
 const g=new T.Group(),platforms=typeof world==='number'?new WorldState(world).geo.platforms:[{x:0,z:25,w:18,d:50,h:0}];const batches=kit.decor(g,{world,zone:0,platforms,length:60});assert(batches.length>0);assert(batches.length<24);let count=0;for(const b of batches){assert(b.isInstancedMesh);assert([...b.instanceMatrix.array].every(Number.isFinite));count+=b.count;b.dispose();}console.log(world,count,'decorative parts in',batches.length,'batches');}
for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();

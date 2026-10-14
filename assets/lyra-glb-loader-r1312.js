import * as THREE from './vendor/three-r170.module.min.js';

/** Lightweight, self-hosted GLB reader for the ANDRIK/Lyra R1312 rig.
 * This reader deliberately accepts a constrained uncompressed glTF/GLB subset:
 * skinned meshes, named bones, PBR factors, and quaternion rotation clips.
 * It does not claim to be a full replacement for three/addons/GLTFLoader.
 */
export async function loadLyraGlb(url, signal) {
  const res = await fetch(url, {cache: 'no-cache', signal});
  if (!res.ok) throw new Error(`GLB HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);
  if (dv.getUint32(0, true) !== 0x46546c67 || dv.getUint32(4, true) !== 2 || dv.getUint32(8, true) !== buf.byteLength) {
    throw new Error('Неподдерживаемый формат GLB');
  }
  let json = null, binary = null;
  for (let p = 12; p < buf.byteLength;) {
    const len = dv.getUint32(p, true), type = dv.getUint32(p + 4, true);
    if (p + 8 + len > buf.byteLength) throw new Error('Повреждённые данные GLB');
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(bytes.subarray(p + 8, p + 8 + len)));
    if (type === 0x004e4942) binary = bytes.subarray(p + 8, p + 8 + len);
    p += 8 + len;
  }
  if (!json || !binary || !Array.isArray(json.skins) || !json.meshes) throw new Error('Модель не содержит скелета');
  const gltf = json;
  const componentSize = {5121:1, 5123:2, 5125:4, 5126:4};
  const components = {SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT4:16};
  function readAccessor(id) {
    const a = gltf.accessors[id]; const v = gltf.bufferViews[a.bufferView];
    if (a.sparse || !componentSize[a.componentType] || !components[a.type]) throw new Error('Unsupported accessor');
    const n = components[a.type], element = componentSize[a.componentType], stride = v.byteStride || n * element;
    const base = binary.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0);
    const view = new DataView(binary.buffer);
    const C = {5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.componentType];
    const result = new C(a.count * n);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) {
      const offset = base + i * stride + k * element;
      if (a.componentType === 5121) result[i*n+k] = view.getUint8(offset);
      if (a.componentType === 5123) result[i*n+k] = view.getUint16(offset, true);
      if (a.componentType === 5125) result[i*n+k] = view.getUint32(offset, true);
      if (a.componentType === 5126) result[i*n+k] = view.getFloat32(offset, true);
    }
    return result;
  }
  const gltfSkin = gltf.skins[0];
  const jointIndex = new Map(gltfSkin.joints.map((nodeId, i) => [nodeId, i]));
  const bones = gltfSkin.joints.map(nodeId => {
    const spec = gltf.nodes[nodeId];
    const bone = new THREE.Bone(); bone.name = spec.name;
    bone.position.fromArray(spec.translation || [0,0,0]);
    bone.quaternion.fromArray(spec.rotation || [0,0,0,1]);
    bone.scale.fromArray(spec.scale || [1,1,1]);
    return bone;
  });
  const root = new THREE.Group(); root.name = 'Lyra_Rigged_R1312';
  gltfSkin.joints.forEach((nodeId, i) => {
    let par = null;
    gltfSkin.joints.forEach((candidate, j) => {if (gltf.nodes[candidate].children?.includes(nodeId)) par = bones[j];});
    (par || root).add(bones[i]);
  });
  root.updateMatrixWorld(true);
  const ibm = readAccessor(gltfSkin.inverseBindMatrices);
  const inverses = bones.map((_,i) => new THREE.Matrix4().fromArray(ibm, 16*i));
  const skeleton = new THREE.Skeleton(bones, inverses);
  const palette = (gltf.materials || []).map(m => {
    const p = m.pbrMetallicRoughness || {}, rgba = p.baseColorFactor || [1,1,1,1];
    return new THREE.MeshStandardMaterial({name:m.name || 'material',color:new THREE.Color().setRGB(rgba[0],rgba[1],rgba[2]),roughness:p.roughnessFactor ?? 1,metalness:p.metallicFactor ?? 0, side:m.doubleSided?THREE.DoubleSide:THREE.FrontSide,transparent:rgba[3]<.99,opacity:rgba[3]});
  });
  const geometryCache = new Map();
  for (const primitive of gltf.meshes[0].primitives) {
    const geom = new THREE.BufferGeometry();
    for (const [key, attr] of Object.entries(primitive.attributes)) {
      const alias = {POSITION:'position',NORMAL:'normal',JOINTS_0:'skinIndex',WEIGHTS_0:'skinWeight',TEXCOORD_0:'uv'}[key];
      if (!alias) continue;
      const acc = gltf.accessors[attr];
      geom.setAttribute(alias, new THREE.BufferAttribute(readAccessor(attr), components[acc.type]));
    }
    if (primitive.indices !== undefined) geom.setIndex(new THREE.BufferAttribute(readAccessor(primitive.indices),1));
    const skin = new THREE.SkinnedMesh(geom,palette[primitive.material] || palette[0]);
    skin.name = 'Lyra_'+(palette[primitive.material]?.name||'part');
    skin.castShadow = true; skin.receiveShadow = true;
    root.add(skin);
    skin.bind(skeleton, new THREE.Matrix4());
  }
  const actions = {};
  for (const a of gltf.animations || []) {
    const tracks = [];
    for (const ch of a.channels) {
      const samp = a.samplers[ch.sampler];
      const nodeId = ch.target.node;
      if (!jointIndex.has(nodeId)) continue;
      const times = readAccessor(samp.input), values = readAccessor(samp.output);
      const target = `${gltf.nodes[nodeId].name}`;
      if (ch.target.path === 'rotation') {
        tracks.push(new THREE.QuaternionKeyframeTrack(`${target}.quaternion`, times, values));
      } else if (ch.target.path === 'translation') {
        tracks.push(new THREE.VectorKeyframeTrack(`${target}.position`, times, values));
      } else if (ch.target.path === 'scale') {
        tracks.push(new THREE.VectorKeyframeTrack(`${target}.scale`, times, values));
      }
    }
    actions[a.name] = new THREE.AnimationClip(a.name,-1,tracks);
  }
  // The microphone is an additional game prop, attached to the real hand bone.
  // Hide it outside Mic_Shout_Strike; no separate model download is required.
  const microphone = new THREE.Group(); microphone.name = 'Lyra_Microphone';
  const micBlack = new THREE.MeshStandardMaterial({color:0x10131a,metalness:.45,roughness:.3});
  const micSilver = new THREE.MeshStandardMaterial({color:0xa7b8c9,metalness:.75,roughness:.24});
  const micMesh = (geometry,material,x,y,z) => {
    const object=new THREE.Mesh(geometry,material); object.position.set(x,y,z);object.castShadow=true;microphone.add(object);return object;
  };
  micMesh(new THREE.CylinderGeometry(.014,.016,.17,12),micBlack,0,-.025,.03);
  micMesh(new THREE.SphereGeometry(.035,12,8),micSilver,0,.085,.03);
  for(let i=0;i<4;i++) micMesh(new THREE.TorusGeometry(.028,.002,4,16),micBlack,0,.071+i*.009,.03).rotation.x=Math.PI/2;
  bones[jointIndex.get(gltfSkin.joints.find(k=>gltf.nodes[k].name==='Hand_R'))].add(microphone);
  microphone.visible=false;
  const mouth=new THREE.Mesh(
    new THREE.SphereGeometry(.018,16,12),
    new THREE.MeshStandardMaterial({color:0x291016,roughness:.86})
  );
  mouth.name='Shout_Expression';mouth.scale.set(1,1.45,.24);
  mouth.position.set(0,-.067,.119);
  const headBone=bones[jointIndex.get(gltfSkin.joints.find(k=>gltf.nodes[k].name==='Head'))];
  headBone.add(mouth);mouth.visible=false;
  const mixer = new THREE.AnimationMixer(root);
  let current = null, currentName='';
  const oneShots = new Set(Object.keys(actions).filter(name=>gltf.animations.find(a=>a.name===name)?.extras?.oneShot));
  mixer.addEventListener('finished', e=>{ if (e.action===current && currentName!=='Idle') play('Idle',.20); });
  function play(name, transition=.16) {
    const clip = actions[name] || actions.Idle; if (!clip) return;
    if (current?.getClip()===clip && current?.isRunning()) return;
    const previous=current;
    const action=mixer.clipAction(clip);
    action.reset(); action.enabled=true;action.setEffectiveWeight(1);action.setEffectiveTimeScale(1);
    action.setLoop(oneShots.has(clip.name)?THREE.LoopOnce:THREE.LoopRepeat,Infinity);
    action.clampWhenFinished=oneShots.has(clip.name);
    action.play();
    if (previous && previous!==action) previous.crossFadeTo(action,Math.max(.01,transition),false);
    current=action;currentName=clip.name;
    microphone.visible=currentName==='Mic_Shout_Strike';
    mouth.visible=false;
  }
  play('Idle',0);
  return {root,mixer,actions,bones,play,microphone,get currentName(){return currentName;},get currentTime(){return current?.time||0;},update(dt){
    mixer.update(dt);
    const vocal=currentName==='Mic_Shout_Strike' && current?.time>.28 && current?.time<.98;
    mouth.visible=vocal;
    if(microphone.visible) microphone.rotation.x=Math.sin((current?.time||0)*4)*.06;
  },dispose(){mixer.stopAllAction();root.traverse(o=>{o.geometry?.dispose();if(o.isMesh)o.material?.dispose();});}};
}

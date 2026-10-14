import * as THREE from './vendor/three-r170.module.min.js';

/** Lightweight, self-hosted GLB reader for the ANDRIK/Lyra R1311 rig.
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
  const root = new THREE.Group(); root.name = 'Lyra_Rigged_R1311';
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
      if (ch.target.path !== 'rotation') continue;
      const samp = a.samplers[ch.sampler];
      const nodeId = ch.target.node;
      if (!jointIndex.has(nodeId)) continue;
      tracks.push(new THREE.QuaternionKeyframeTrack(`${gltf.nodes[nodeId].name}.quaternion`,readAccessor(samp.input),readAccessor(samp.output)));
    }
    actions[a.name] = new THREE.AnimationClip(a.name,-1,tracks);
  }
  const mixer = new THREE.AnimationMixer(root);
  let current = null;
  function play(name, transition=.18) {
    const clip = actions[name] || actions.Idle; if (!clip || current?.getClip() === clip) return;
    const action = mixer.clipAction(clip); action.reset().play();
    if (current) current.crossFadeTo(action,Math.max(.01,transition),false);
    current = action;
  }
  play('Idle',0);
  return {root,mixer,actions,bones,play,dispose(){mixer.stopAllAction();root.traverse(o=>{o.geometry?.dispose();if(o.isMesh)o.material?.dispose();});}};
}

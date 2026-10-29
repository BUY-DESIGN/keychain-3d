import * as THREE from 'three';
import {smoothNormals} from './normals.js';
// Reconstruct the existing front cap, including holes, for a true rounded rim.
export function bevelPlate(geometry,options={}){
 const g=geometry.index?geometry.toNonIndexed():geometry.clone(),p=g.attributes.position;
 g.computeBoundingBox();const lo=g.boundingBox.min.z,hi=g.boundingBox.max.z;
 const edges=new Map(),points=new Map(),key=v=>`${Math.round(v.x*1e7)},${Math.round(v.y*1e7)}`;
 for(let i=0;i<p.count;i+=3){
  const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j));
  if(!v.every(a=>Math.abs(a.z-hi)<1e-7))continue;
  for(let j=0;j<3;j++){const a=key(v[j]),b=key(v[(j+1)%3]),id=[a,b].sort().join('|');points.set(a,new THREE.Vector2(v[j].x,v[j].y));const e=edges.get(id);if(e)e.count++;else edges.set(id,{a,b,count:1});}
 }
 const next=new Map();for(const e of edges.values())if(e.count===1){if(!next.has(e.a))next.set(e.a,[]);if(!next.has(e.b))next.set(e.b,[]);next.get(e.a).push(e.b);next.get(e.b).push(e.a);}
 const used=new Set(),loops=[];
 for(const start of next.keys()){
  if(used.has(start))continue;let prev=null,current=start;const loop=[];
  do{used.add(current);loop.push(points.get(current));const candidate=next.get(current)?.find(x=>x!==prev);prev=current;current=candidate;}while(current&&current!==start&&!used.has(current));
  if(current!==start||loop.length<3)throw Error('Invalid plate contour');loops.push(loop);
 }
 loops.sort((a,b)=>Math.abs(THREE.ShapeUtils.area(b))-Math.abs(THREE.ShapeUtils.area(a)));
 if(!loops.length)throw Error('Plate front cap not found');
 const shape=new THREE.Shape(loops[0]);for(const loop of loops.slice(1)){
  if(options.holeOffset)for(const point of loop)point.add(new THREE.Vector2(...options.holeOffset));
  shape.holes.push(new THREE.Path(loop));
 }
 const bevel=Math.min(options.radius??.00020,(hi-lo)*(options.ratio??.16));
 const rounded=new THREE.ExtrudeGeometry(shape,{depth:hi-lo-2*bevel,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:options.segments??6,steps:1,curveSegments:24});
 rounded.translate(0,0,lo+bevel);g.dispose();return rounded;
}
export function finishSurfaces(model,anisotropy=4){
 const report={smoothed:0,beveled:0,materials:[]};
 model.traverse(o=>{
  if(!o.isMesh)return;const old=o.material,name=old.name;
  const lettering=/lettering/i.test(name);if(lettering)return;
  const id=o.name.toLowerCase().replace(/[^a-z]/g,'');
  const clasp=/^(carabiner|claspbase|latch|claspmountingeye|swivel)$/.test(id);
  let geometry=o.geometry;
  if(name==='Paper'||name==='Orange'||/^(carabiner|claspbase)$/.test(o.name.toLowerCase().replace(/[^a-z]/g,''))){geometry=bevelPlate(geometry,clasp?{radius:.00045,ratio:.24,segments:10}:(id==='brandtag'?{holeOffset:[-.08628,.05055]}:{}));report.beveled++;}
  const smooth=smoothNormals(geometry,name==='Resin'?Math.PI*.44:Math.PI/3);
  const original=o.geometry;o.geometry=smooth;report.smoothed++;
  if(geometry!==original)geometry.dispose();original.dispose();
  const mat=new THREE.MeshPhysicalMaterial({name,color:old.color.clone(),map:old.map,side:THREE.FrontSide,metalness:0,roughness:.22,clearcoat:.55,clearcoatRoughness:.14,envMapIntensity:1.25});
  if(name==='Chrome')mat.setValues({color:0xf3f5f7,metalness:1,roughness:.12,clearcoat:.18,clearcoatRoughness:.1,envMapIntensity:1.45});
  if(name==='RoseGold'){
   mat.setValues({color:0xffc6a3,metalness:1,roughness:.19,clearcoat:.25,clearcoatRoughness:.12,envMapIntensity:1.65});
   mat.normalMap=old.normalMap;mat.normalScale.set(.012,.012);
  }
  if(name==='Paper'||name==='Orange')mat.setValues({map:null,color:0xff501d,roughness:.23,clearcoat:.7,clearcoatRoughness:.15,ior:1.46});
  if(name==='Resin')mat.setValues({roughness:.19,clearcoat:.8,clearcoatRoughness:.13,transmission:.10,thickness:.006,ior:1.43,attenuationColor:new THREE.Color('#ffb587'),attenuationDistance:.05});
  for(const map of [mat.map,mat.normalMap])if(map){map.anisotropy=anisotropy;map.needsUpdate=true;}
  mat.flatShading=false;o.material=mat;o.castShadow=true;o.receiveShadow=false;report.materials.push({name,roughness:mat.roughness,metalness:mat.metalness,clearcoat:mat.clearcoat});
 });return report;
}

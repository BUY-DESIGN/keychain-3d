import * as THREE from 'three';
// Angle-weighted normals are independent of how a planar cap was triangulated.
// Weld only coincident positions, retain UV seams and deliberate sharp edges.
export function smoothNormals(geometry,crease=Math.PI/3){
 const input=geometry.index?geometry.toNonIndexed():geometry.clone();
 const p=input.attributes.position,uv=input.attributes.uv;
 const positions=[],texcoords=[],faces=[],adjacency=new Map();
 const hash=v=>`${Math.round(v.x*1e8)},${Math.round(v.y*1e8)},${Math.round(v.z*1e8)}`;
 for(let i=0;i<p.count;i+=3){
  const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j));
  const cross=new THREE.Vector3().subVectors(v[1],v[0]).cross(new THREE.Vector3().subVectors(v[2],v[0]));
  if(cross.lengthSq()<1e-24)continue;
  const normal=cross.normalize(),keys=v.map(hash);
  const face={normal,keys};faces.push(face);
  for(let j=0;j<3;j++){
   positions.push(...v[j].toArray());if(uv)texcoords.push(uv.getX(i+j),uv.getY(i+j));
   const a=new THREE.Vector3().subVectors(v[(j+1)%3],v[j]).normalize();
   const b=new THREE.Vector3().subVectors(v[(j+2)%3],v[j]).normalize();
   const angle=Math.acos(THREE.MathUtils.clamp(a.dot(b),-1,1));
   if(!adjacency.has(keys[j]))adjacency.set(keys[j],[]);
   adjacency.get(keys[j]).push({normal,angle});
  }
 }
 const normals=[],threshold=Math.cos(crease),sum=new THREE.Vector3();
 for(const face of faces)for(const k of face.keys){
  sum.set(0,0,0);for(const n of adjacency.get(k))if(face.normal.dot(n.normal)>threshold)sum.addScaledVector(n.normal,n.angle);
  if(sum.lengthSq()<1e-12)sum.copy(face.normal);sum.normalize();normals.push(...sum.toArray());
 }
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 if(uv)result.setAttribute('uv',new THREE.Float32BufferAttribute(texcoords,2));
 result.computeBoundingBox();result.computeBoundingSphere();input.dispose();return result;
}

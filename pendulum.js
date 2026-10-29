// Articulated, damped spring pendulums. Fixed-length links and hard ring anchors.
// Rest-angle springs represent joint resistance and keep the authored composition.
// This is a lightweight secondary-motion model, not collision-based rigid bodies.
export function installPendantPhysics(THREE,model,camera,canvas){
 const vec=a=>new THREE.Vector3(...a).multiplyScalar(.025);
 const normal=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
 const all=[];model.traverse(o=>{if(o.isMesh)all.push(o)});
 const chrome=all.find(o=>o.material?.name==='Chrome').material;
 const specs=[
  {names:['Slime house','House mounting eye'],remove:['Chain 0','Chain 1','Chain 2'],angle:-50,oldAnchor:[-.46,.88,0],eye:[-1.058,.40,0],links:5,direct:true,length:.017,mass:1.1,frequency:2.1,depth:.01},
  {names:['Rose gold key'],remove:['Key loop'],angle:-13,oldAnchor:[-.10,.68,0],eye:[-.10+.275*Math.sin(.20),.18+.275*Math.cos(.20),.16],links:2,direct:true,length:.008,mass:1.7,frequency:1.75,depth:.16},
  {names:['Key silhouette plate','Slogan lettering'],remove:['Plate attachment'],angle:14,oldAnchor:[.15,.69,0],eye:[.35-.10*Math.cos(.10)-.98*Math.sin(.10),-.50-.10*Math.sin(.10)+.98*Math.cos(.10),-.10],links:2,direct:true,length:.0100,hole:true,direction:[.0998,-.995,0],terminalTwist:0,mass:.8,frequency:2.6,depth:-.06},
  {names:['Brand tag','Brand lettering'],remove:['Tag connector'],angle:50,oldAnchor:[.44,.86,0],eye:[.67+.07*Math.cos(-.53)-.08628,.612+.07*Math.sin(-.53)+.05055,.04],links:2,direct:true,length:.0090,hole:true,direction:[.8628,-.5055,0],terminalTwist:20,mass:.65,frequency:2.9,depth:.03}
 ];
 // Ring wire radius is 0.055 model units. The hanger aperture encloses it
 // with clearance, rather than terminating a connector inside the solid wire.
 const ringWire=.055*.025,hangerRadius=.00265,hangerWire=.0004,clearance=.00015;
 const hangerOffset=hangerRadius-ringWire-hangerWire-clearance;
 const bodies=[],targets=[],up=new THREE.Vector3(0,1,0);
 model.updateWorldMatrix(true,true);
 // Rounded oval links with contact overlap. The middle joint apertures
 // are offset from the shared pivot so alternating loops interlock instead
 // of occupying the same circle. Only terminal apertures enclose solid eyes.
 function linkGeometry(length,r,tube,first,last,hole=false,depthRadius=r){
  const overlap=.00058;
  // Plate holes meet the bottom tip of the loop, not its aperture centre.
  const top=length/2-(last?(hole?r:0):r-overlap);
  const bottom=-length/2+(first?0:r-overlap);
  const points=[];
  for(let i=0;i<=40;i++){const a=i/40*Math.PI;points.push(new THREE.Vector3(0,top+r*Math.sin(a),depthRadius*Math.cos(a)));}
  for(let i=0;i<=40;i++){const a=Math.PI+i/40*Math.PI;points.push(new THREE.Vector3(0,bottom+r*Math.sin(a),depthRadius*Math.cos(a)));}
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true,'centripetal'),160,tube,16,true);
 }
 for(const spec of specs){
  const members=all.filter(o=>spec.names.map(normal).includes(normal(o.name)));
  if(!members.length)continue;
  for(const o of all.filter(o=>spec.remove.map(normal).includes(normal(o.name)))){o.removeFromParent();o.geometry.dispose();}
  const a=spec.angle*Math.PI/180,anchor=vec([.68*Math.sin(a),1.25-.68*Math.cos(a),0]);
  const radial=new THREE.Vector3(Math.sin(a),-Math.cos(a),0),depth=new THREE.Vector3(0,0,1);
  const tangent=new THREE.Vector3().crossVectors(radial,depth);
  const hanger=new THREE.Mesh(new THREE.TorusGeometry(hangerRadius,hangerWire,16,96),chrome);
  hanger.name='Hanger_'+normal(spec.names[0]);hanger.castShadow=true;
  hanger.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(radial,depth,tangent));model.add(hanger);hanger.visible=!spec.direct;
  const chainAnchor=anchor.clone().addScaledVector(radial,hangerOffset+hangerRadius);
  const eye=vec(spec.eye),rest=eye.clone().sub(vec(spec.oldAnchor));rest.z+=(spec.depth-spec.eye[2])*.025;
  if(!spec.direct)rest.sub(radial.clone().multiplyScalar(hangerOffset+hangerRadius));
  rest.y-=spec.direct?.004:.003;
  // Compact reference-sized links; move the charm with the lower endpoint.
  if(spec.direction)rest.set(...spec.direction);
  if(spec.direct)rest.setLength(spec.length);
  else rest.multiplyScalar(.82);
  const pivot=new THREE.Group();pivot.name='Suspension_'+normal(spec.names[0]);pivot.position.copy(eye);model.add(pivot);pivot.updateWorldMatrix(true,false);
  for(const mesh of members){pivot.attach(mesh);targets.push(mesh);}
  const body={pivot,anchor,chainAnchor,radial,hanger,rest,eye,spec,segments:[],angle:[0,0,0],velocity:[0,0,0]};
  members.forEach(o=>o.userData.pendulum=body);hanger.userData.pendulum=body;if(!spec.direct)targets.push(hanger);
  for(let i=0;i<spec.links;i++){
   const dir=rest.clone().divideScalar(spec.links);
   const last=i===spec.links-1;
   const radius=i===0?.0025:(spec.hole&&last?.00175:(spec.links>2?.00165:.00225));
   // Give the thick key bow depth clearance without enlarging its front outline.
   const depthRadius=last?(spec.hole?.0026:(spec.names[0]==='Rose gold key'?.0038:radius)):radius;
   const mesh=new THREE.Mesh(linkGeometry(dir.length(),radius,.00036,i===0,last,spec.hole,depthRadius),chrome);
   mesh.name='Articulated_'+normal(spec.names[0])+'_'+i;mesh.castShadow=true;model.add(mesh);
   mesh.userData.pendulum=body;targets.push(mesh);
   body.segments.push({dir,mesh,angle:[0,0],velocity:[0,0],start:new THREE.Vector3(),end:new THREE.Vector3()});
  }
  bodies.push(body);
 }
 const q=new THREE.Quaternion(),twist=new THREE.Quaternion(),euler=new THREE.Euler();
 function pose(){
  for(const b of bodies){
   // Roll around the wire in its radial/depth plane. The opening continues
   // to enclose the wire throughout the swing; it cannot sink into the torus.
   const roll=THREE.MathUtils.clamp(b.angle[0]*.5+b.segments[0].angle[0]*.5,-.28,.28);
   const outward=b.radial.clone().multiplyScalar(Math.cos(roll)).add(new THREE.Vector3(0,0,Math.sin(roll)));
   b.hanger.position.copy(b.anchor).addScaledVector(outward,hangerOffset);
   b.chainAnchor.copy(b.hanger.position).addScaledVector(outward,hangerRadius);
   if(b.spec.direct)b.chainAnchor.copy(b.anchor);
   let point=b.chainAnchor.clone();
   for(let i=0;i<b.segments.length;i++){
    const s=b.segments[i];q.setFromEuler(euler.set(s.angle[0],0,s.angle[1]));
    const direction=s.dir.clone().applyQuaternion(q);s.start.copy(point);s.end.copy(point).add(direction);
    s.mesh.position.copy(point).addScaledVector(direction,.5);
    if(b.spec.direct){
     const y=direction.clone().normalize();
     const x=new THREE.Vector3(-b.radial.y,b.radial.x,0);x.addScaledVector(y,-x.dot(y)).normalize();
     const z=new THREE.Vector3().crossVectors(x,y).normalize();
     s.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
    }else s.mesh.quaternion.setFromUnitVectors(up,direction.clone().normalize());
    // Alternate oblique planes: both terminal loops still pass through the
    // depth of the main ring and the charm eye.
    twist.setFromAxisAngle(up,(i===b.segments.length-1&&b.spec.terminalTwist!==undefined?b.spec.terminalTwist:(i%2?35:-35))*Math.PI/180);s.mesh.quaternion.multiply(twist);
    point=s.end.clone();
   }
   b.pivot.position.copy(point);
   b.pivot.rotation.set(b.angle[0],b.angle[2],b.angle[1]);
  }
  model.updateWorldMatrix(true,true);
 }
 pose();
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),preference=matchMedia('(prefers-reduced-motion: reduce)');
 let last=null,previous=null,accumulator=0,disposed=false;
 const position=new THREE.Vector3(),lastPosition=new THREE.Vector3(),velocity=new THREE.Vector3(),lastVelocity=new THREE.Vector3(),acceleration=new THREE.Vector3(),inverse=new THREE.Quaternion(),worldQ=new THREE.Quaternion(),gravity=new THREE.Vector3();
 model.getWorldPosition(lastPosition);const basePosition=lastPosition.clone();
 function move(event){
  if(preference.matches)return;
  const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);
  model.updateWorldMatrix(true,true);ray.setFromCamera(pointer,camera);
  const b=ray.intersectObjects(targets,false)[0]?.object.userData.pendulum;
  if(b){
   const dt=last?Math.max(.008,(event.timeStamp-last.t)/1000):.016;
   const dx=last?THREE.MathUtils.clamp((event.clientX-last.x)/r.width/dt,-2,2):.15;
   const dy=last?THREE.MathUtils.clamp(-(event.clientY-last.y)/r.height/dt,-2,2):0;
   const entry=b!==previous ? .95*Math.sign(dx||1) : 0;
   const impulse=(dx*Math.min(dt,.05)*12+entry)/b.spec.mass;
   const depthImpulse=(dy*Math.min(dt,.05)*7+entry*.30)/b.spec.mass;
   b.velocity[1]=THREE.MathUtils.clamp(b.velocity[1]-impulse,-4,4);
   b.velocity[0]=THREE.MathUtils.clamp(b.velocity[0]+depthImpulse,-3,3);
   b.velocity[2]=THREE.MathUtils.clamp(b.velocity[2]+impulse*.55,-2.8,2.8);
   // The impulse travels up the attachment: strongest next to the pendant,
   // weaker near the ring. Fixed endpoints prevent any link from detaching.
   for(let j=0;j<b.segments.length;j++){
    const segment=b.segments[j],transfer=.5+.5*(j+1)/b.segments.length;
    segment.velocity[1]=THREE.MathUtils.clamp(segment.velocity[1]-impulse*transfer,-4,4);
    segment.velocity[0]=THREE.MathUtils.clamp(segment.velocity[0]+depthImpulse*transfer,-3,3);
   }
  }
  previous=b;last={x:event.clientX,y:event.clientY,t:event.timeStamp};
 }
 function leave(){last=null;previous=null;}
 canvas.style.touchAction='none';canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerdown',move);canvas.addEventListener('pointerleave',leave);
 function reset(){
  for(const b of bodies){b.angle.fill(0);b.velocity.fill(0);for(const s of b.segments){s.angle.fill(0);s.velocity.fill(0);}}
  accumulator=0;lastVelocity.set(0,0,0);model.getWorldPosition(lastPosition);leave();pose();
 }
 function spring(angle,speed,target,omega,damping,h,limit){
  speed+=((target-angle)*omega*omega-2*damping*omega*speed)*h;angle+=speed*h;
  if(Math.abs(angle)>limit){angle=THREE.MathUtils.clamp(angle,-limit,limit);speed*=.1;}
  return [angle,speed];
 }
 return {
  count:bodies.length,reset,
  diagnostics(){return bodies.map(b=>({name:b.spec.names[0],anchor:b.anchor.toArray(),chainAnchor:b.chainAnchor.toArray(),hangerCenter:b.hanger.position.toArray(),hangerRadius,hangerWire,wireClearance:clearance,ringRadius:Math.hypot(b.anchor.x,b.anchor.y-.03125),position:b.pivot.position.toArray(),angles:[...b.angle],segments:b.segments.map(s=>({angles:[...s.angle],start:s.start.toArray(),end:s.end.toArray(),restLength:s.dir.length(),length:s.start.distanceTo(s.end)}))}));},
  update(delta){
   if(disposed)return;if(preference.matches){reset();return;}
   const dt=Math.max(.001,Math.min(delta,.05));model.updateWorldMatrix(true,true);model.getWorldPosition(position);model.getWorldQuaternion(worldQ);inverse.copy(worldQ).invert();
   velocity.copy(position).sub(lastPosition).divideScalar(dt);acceleration.copy(velocity).sub(lastVelocity).divideScalar(dt).clampLength(0,1.5).applyQuaternion(inverse);
   lastPosition.copy(position);lastVelocity.copy(velocity);
   gravity.set(0,-1,0).applyQuaternion(inverse);
   // Visible secondary motion: vertical compliance plus a velocity term gives
   // each attachment a different phase during slow floating.
   const heave=THREE.MathUtils.clamp(position.y-basePosition.y,-.003,.003);
   accumulator+=dt;const h=1/120;
   while(accumulator>=h){
    for(let k=0;k<bodies.length;k++){
     const b=bodies[k],side=Math.sign(b.rest.x)||1;
     const drive=[-gravity.z*.65-acceleration.z*.06+heave*(k%2?-45:38)+velocity.y*(k%2?5:-4),gravity.x*.65+acceleration.x*.06+heave*side*24];
     for(let j=0;j<b.segments.length;j++){
      const s=b.segments[j],parent=j?b.segments[j-1].angle:drive;
      for(let axis=0;axis<2;axis++){
       const target=drive[axis]*.60+parent[axis]*.25+b.angle[axis]*.15;
       [s.angle[axis],s.velocity[axis]]=spring(s.angle[axis],s.velocity[axis],target,b.spec.frequency*2*Math.PI/(1+j*.26),.30,h,.38);
      }
     }
     const end=b.segments.at(-1);
     const targets=[drive[0]*.6+end.angle[0]*.4,drive[1]*.6+end.angle[1]*.4,heave*(k%2?36:-32)];
     for(let axis=0;axis<3;axis++)[b.angle[axis],b.velocity[axis]]=spring(b.angle[axis],b.velocity[axis],targets[axis],b.spec.frequency*2*Math.PI*(axis===2?.45:.65),.24,h,.48);
    }
    accumulator-=h;
   }
   pose();
  },
  dispose(){disposed=true;canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerdown',move);canvas.removeEventListener('pointerleave',leave);}
 };
}

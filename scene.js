
import * as THREE from 'three';
import {GLTFLoader} from 'loader';
import {finishSurfaces} from './surface.js';
import {installFloating} from './float.js';
import {installCursorTilt} from './tilt.js';
import {installPendantPhysics} from 'pendulum';
const status=document.getElementById('status');
try {
const scene=new THREE.Scene();
const camera=new THREE.OrthographicCamera(-.1,.1,.1,-.1,.001,10);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
document.body.prepend(renderer.domElement);
// The supplied image is screen-aligned and is not affected by lighting or exposure.
const background=new THREE.TextureLoader().load('./background.jpg',()=>resize());
background.colorSpace=THREE.SRGBColorSpace;scene.background=background;
// Broad photographic softboxes become real reflection sources through PMREM.
const studio=new THREE.Scene();studio.background=new THREE.Color(.04,.033,.029);
function softbox(x,y,z,w,h,power,color){
 const mat=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);mesh.position.set(x,y,z);mesh.lookAt(0,0,0);studio.add(mesh);
}
// Larger, dimmer peach-white panels give broad, gently graded reflections.
softbox(-3,3,4,4.8,6.5,1.8,'#ffe9dc');
softbox(3,1,3,4.4,6,1.25,'#fff1e8');
softbox(0,4,-1,5,3,1.5,'#ffe8d9');
softbox(-1,-2,3,4,2.5,.55,'#ffdcca');
softbox(0,0,-4,3.5,5,.9,'#fff3eb');
const pmrem=new THREE.PMREMGenerator(renderer);
const env=pmrem.fromScene(studio,.065);
scene.environment=env.texture;scene.environmentIntensity=1;
pmrem.dispose();studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
scene.add(new THREE.HemisphereLight(0xffeadf,0xb88c77,.35));
// Transparent receiver preserves the supplied photograph and adds only shadows.
const receiver=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShadowMaterial({color:0x68463e,opacity:.15,depthWrite:false}));
receiver.position.set(0,0,-.028);receiver.receiveShadow=true;scene.add(receiver);
// ShadowMaterial reads the shadow map independently of light intensity.
// This light casts the backdrop shadow without adding exposure to the model.
const keyLight=new THREE.DirectionalLight(0xfff6ed,0);
keyLight.position.set(-.07,.12,.24);keyLight.target.position.set(0,.015,0);
keyLight.castShadow=true;keyLight.shadow.mapSize.set(2048,2048);
Object.assign(keyLight.shadow.camera,{left:-.13,right:.13,top:.15,bottom:-.15,near:.01,far:1});
keyLight.shadow.camera.updateProjectionMatrix();
keyLight.shadow.bias=-.00002;keyLight.shadow.normalBias=.00002;
keyLight.shadow.radius=20;keyLight.shadow.blurSamples=24;
scene.add(keyLight,keyLight.target);
let model,physics,tilt,floating;const clock=new THREE.Clock();
function resize(){
 const aspect=innerWidth/innerHeight;
 // Fixed front view. On narrow displays preserve the full horizontal silhouette.
 const height=Math.max(.1375,.112/aspect),width=height*aspect;
 camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;
 camera.position.set(0,.014,.35);camera.lookAt(0,.014,0);camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
 const imageAspect=2048/1216;
 background.repeat.set(Math.min(1,aspect/imageAspect),Math.min(1,imageAspect/aspect));
 background.offset.set((1-background.repeat.x)/2,(1-background.repeat.y)/2);
}
resize();addEventListener('resize',resize);

new GLTFLoader().load('./keychain.glb',g=>{
 model=g.scene;
 const surfaceReport=finishSurfaces(model,renderer.capabilities.getMaxAnisotropy());
 const rig=new THREE.Group();rig.position.set(0,.014,0);scene.add(rig);
 model.position.y=-.014;rig.add(model);
 physics=installPendantPhysics(THREE,model,camera,renderer.domElement);
 tilt=installCursorTilt(rig,renderer.domElement);
 floating=installFloating(rig);
 // Read-only diagnostic surface for interaction and camera regression checks.
 window.__studio={scene,camera,model,physics,tilt,floating,surfaceReport,renderer};
},undefined,error=>{status.hidden=false;status.textContent='Не удалось загрузить модель';console.error(error)});
renderer.setAnimationLoop(()=>{const dt=clock.getDelta();floating?.update(dt);tilt?.update(dt);physics?.update(dt);renderer.render(scene,camera)});
}catch(error){status.hidden=false;status.textContent='Для 3D нужен WebGL. Откройте страницу в Chrome, Edge или Safari с аппаратным ускорением.';console.error(error)}

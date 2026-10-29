import * as THREE from 'three';
export function installCursorTilt(group,canvas){
 const target=new THREE.Vector2(),motion=matchMedia('(prefers-reduced-motion: reduce)');
 function move(e){if(motion.matches)return;const r=canvas.getBoundingClientRect();target.set(THREE.MathUtils.clamp((e.clientX-r.left)/r.width*2-1,-1,1)*THREE.MathUtils.degToRad(12),THREE.MathUtils.clamp((e.clientY-r.top)/r.height*2-1,-1,1)*THREE.MathUtils.degToRad(8));}
 function leave(){target.set(0,0);}
 canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('pointercancel',leave);
 const up=e=>{if(e.pointerType!=='mouse')leave();};canvas.addEventListener('pointerup',up);motion.addEventListener('change',leave);
 return {update(dt){const a=1-Math.exp(-7*Math.min(dt,.05));group.rotation.y+=(target.x-group.rotation.y)*a;group.rotation.x+=(target.y-group.rotation.x)*a;},reset(){leave();group.rotation.set(0,0,0);},dispose(){canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('pointercancel',leave);canvas.removeEventListener('pointerup',up);motion.removeEventListener('change',leave);}};
}

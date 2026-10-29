// Vertical motion is separate from cursor rotation and pendant physics.
export function installFloating(group){
 const baseY=group.position.y, amplitude=.0012, period=5.5;
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 let time=0,weight=0;
 return {
  update(dt){
   const delta=Math.max(0,Math.min(dt,.05));
   time=(time+delta)%period;
   weight+=( (preference.matches?0:1)-weight )*(1-Math.exp(-3*delta));
   group.position.y=baseY+amplitude*weight*Math.sin(time*2*Math.PI/period);
  },
  reset(){time=0;weight=0;group.position.y=baseY;}
 };
}

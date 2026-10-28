import { terrainHeight,segmentDistance } from './map-math.js';
export function onBridge(e,x,z){return e.a&&e.b&&segmentDistance(x,z,e.a,e.b)<(e.width||6)/2;}
export function worldHeight(recipe,x,z,machines={}){
 let h=terrainHeight(recipe,x,z);
 for(const e of recipe.entities||[])if(['vineNode','coolingChannel'].includes(e.type)&&machines[e.id]?.complete&&onBridge(e,x,z))h=Math.max(h,e.h??(recipe.water?.level??-1)+2.8);
 for(const e of recipe.entities||[])if(e.type==='iceField'&&Math.hypot(x-e.p[0],z-e.p[1])<e.radius)h=Math.max(h,e.h??1.4);
 for(const e of recipe.entities||[])if(e.type==='meltSocket'&&e.hole!==false&&machines[e.id]?.open&&Math.hypot(x-e.p[0],z-e.p[1])<(e.radius||3))h=Math.min(h,(recipe.water?.level??-1)-1.5);
 const ramp=recipe.powerMoments?.ramp;
 if(ramp&&Math.abs(x-ramp.a[0])<ramp.width/2&&z<=ramp.a[1]&&z>=ramp.b[1]-3.5){
  const t=Math.min(1,(ramp.a[1]-z)/(ramp.a[1]-ramp.b[1]));
  h=Math.max(h,.72+t*ramp.rise);
 }
 return h;
}

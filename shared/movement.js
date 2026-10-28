import { terrainHeight,terrainWeights,clamp } from './map-math.js';
export const STEP=1/60;
export function terrainAt(recipe,x,z) {
 const h=terrainHeight(recipe,x,z),w=terrainWeights(recipe,x,z),extra=(recipe.surfaces||[]).find(s=>Math.hypot(x-s.p[0],z-s.p[1])<s.radius);
 return extra?.type|| (h<(recipe.water?.level??-1)+.35?'water':w[3]>.5?'mud':'stone');
}
export function moveVelocity(player,input,recipe,dt=STEP) {
 const d=Math.hypot(input.x,input.z),x=d>1?input.x/d:input.x,z=d>1?input.z/d:input.z;
 const surface=player.waterUntil>player.time?'water':terrainAt(recipe,player.x,player.z),terrain=surface==='mud'?.6:surface==='water'&&player.hero!=='nerali'?.7:1;
 let speed=(player.rope?.attached&&!player.rope.tied?clamp(4.5-(player.rope.tension||0)*2,2.5,4.5):input.sprint?8.5:6)*terrain;
 if(player.cargoTow)speed=Math.min(speed,4);
 if(player.hero==='sera')speed*=1.15;if(player.speedBoost)speed*=1.2;
 const ramp=surface==='ice'&&player.hero!=='nerali'?.4:d>.01?(input.sprint?.2:.12):.1,k=1-Math.exp(-dt/ramp);
 player.vx+=(x*speed-player.vx)*k;player.vz+=(z*speed-player.vz)*k;
 if(player.dodgeUntil>player.time){player.vx=player.facing.x*(4/.35);player.vz=player.facing.z*(4/.35);}
 if(d>.1)player.facing={x:x/(Math.hypot(x,z)||1),z:z/(Math.hypot(x,z)||1)};
 const aim=Math.hypot(input.fx||0,input.fz||0);if(aim>.1)player.facing={x:input.fx/aim,z:input.fz/aim};
 return {x:player.vx*dt,z:player.vz*dt};
}

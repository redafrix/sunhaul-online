import RAPIER from '@dimforge/rapier2d-compat';
import { footprint } from '../../shared/physics-geometry.js';
import { MACHINE_TYPES,objectiveDone } from '../../shared/machines.js';
import { distance } from '../../shared/rope-routing.js';
import { segmentDistance, terrainHeight } from '../../shared/map-math.js';
import { PUZZLE_TYPES } from './puzzles.js';
const support=['cradle','well','receiver','plate','gate','shadowLock','hook','vineNode','hedge','iceField','loadField','meltSocket','bell','avalanche','coolingChannel','steamVent',...PUZZLE_TYPES];
function chargeWave(game,e,s){
 const shades=game.systems.find(v=>v.spawn&&v.shades);if(!shades)return;
 const zone=game.recipe.zones?.find(z=>z.id===e.restores)?.id||e.restores;
 const pool=(game.recipe.shadeSpawns||[]).filter(v=>v.zone===zone).map(v=>v.type);
 const types=pool.length?pool:['lurker','wisp'];
 const count=Math.max(2,Math.round(2.5*game.rules.shadeCount*(.7+.3*game.keeperCount())));
 for(let i=0;i<count&&game.shades.length<48;i++){
  const a=(i/count)*Math.PI*2+game.time,x=s.x+Math.cos(a)*13,z=s.z+Math.sin(a)*13;
  if(terrainHeight(game.recipe,x,z)<=(game.recipe.water?.level??-1))continue;
  const shade=shades.spawn(game,types[i%types.length],x,z,zone);shade.wave=true;
 }
}
export class Machines {
 constructor(game) {
  this.entities=game.recipe.entities.filter(e=>[...MACHINE_TYPES,...support].includes(e.type));this.states={};this.blockers=new Map();
  game.machines=this.states;game.flags={};game.beams=[];
  for(const e of this.entities){this.states[e.id]={id:e.id,type:e.type,x:e.p[0],z:e.p[1],powered:false,active:!!e.active,progress:0,angle:e.angle||0,complete:false,locked:false,route:[],turns:0};
   if(['capstan','winch'].includes(e.type)){const f=footprint({id:`machine-${e.id}`,p:[...e.p.slice(0,1),0,e.p[1]],s:1},{collider:{type:'circle',r:.35},ropeContact:true},.13);game.physics.contacts.push(f);const anchor=game.physics.world.createCollider(RAPIER.ColliderDesc.ball(.35).setTranslation(...e.p));game.physics.solids.set(anchor.handle,{p:{id:f.id},f,collider:anchor});}
   if(e.block){const desc=RAPIER.ColliderDesc.cuboid(...e.block).setTranslation(...e.p).setRotation(-(e.rotation||0)*Math.PI/180);const collider=game.physics.world.createCollider(desc);this.blockers.set(e.id,collider);game.physics.solids.set(collider.handle,{p:{id:`machine-${e.id}`},f:{},collider});}
  }
 }
 nearest(p,game){return this.entities.filter(e=>!(game?.recipe.mission?.secrets?.includes(e.id)&&game.flags[e.id])&&e.type!=='well'&&distance(p,{x:e.p[0],z:e.p[1]})<(e.type==='cradle'?6:3.2)).sort((a,b)=>distance(p,{x:a.p[0],z:a.p[1]})-distance(p,{x:b.p[0],z:b.p[1]}))[0];}
 command(game,p,cmd) {
  if(!['use','interact','turn-back'].includes(cmd))return;const e=this.nearest(p,game);if(!e||game.time-(p.lastUse??-10)<.2)return;
  if(!game.physics.lineOfSight(p,{x:e.p[0],z:e.p[1]},new Set([`machine-${e.id}`,e.propId])))return;
  const s=this.states[e.id],rate=(p.hero==='ivo'?2:1)*(s.overdriveUntil>game.time?3:1);p.lastUse=game.time;p.interactedAt=game.time;s.operator=p.id;
  if(e.requires&&!e.requires.every(id=>this.states[id]?.complete||game.flags[id])){p.hint=e.hint||'Finish the preceding objective first.';return;}
  if(PUZZLE_TYPES.includes(e.type)||e.sequence){game.puzzles?.activate(game,p,e);return;}
  if(e.type==='cradle'){
   const sun=game.physics.snapshot().sun;if(distance(sun,s)>2.6||e.requires&&!e.requires.every(id=>this.states[id]?.complete||game.flags[id]))return;
   if(e.chargeSeconds){s.active=true;return;}
   if(!s.locked){s.locked=s.complete=true;s.progress=1;game.systems.find(a=>a.restore)?.restore(game,e);game.teamwork?.(25);}return;
  }
  if(e.type==='shadowLock'){p.hint=e.hint||'Move the Sun to align the statue’s shadow with the glyph.';return;}
  if(e.type==='receiver'||e.type==='plate')return;
  if(['mirror','prismSocket'].includes(e.type)){s.angle+=(cmd==='turn-back'?-1:1)*Math.PI/6;s.active=true;}
  else if(e.type==='capstan'&&e.ropeRoute){if(s.route.length<e.ropeRoute.length){p.hint=`Wrap the marked posts: ${e.ropeRoute.map((id,i)=>`${i+1}`).join(' → ')}`;return;}s.active=true;s.turns+=rate;}
  else if(e.type==='crane'){
   const sun=game.physics.snapshot().sun;if(!s.powered||distance(sun,s)>(e.captureRadius||4))return;s.active=true;s.carryFrom={x:sun.x,z:sun.z};s.progress=0;
  }
  else if(['crank','capstan'].includes(e.type)){s.turns+=rate;s.active=true;}
  else if(['lever','valve','sluiceGate','winch','drawbridge','gate'].includes(e.type))s.active=!s.active;
  else s.active=true;
  game.teamwork?.(2);p.hint=null;
 }
 forces(game,dt) {
  const sun=game.physics.snapshot().sun;
  for(const e of this.entities){const s=this.states[e.id];if(e.type==='winch'&&s.active&&s.powered&&distance(s,sun)<(e.range||14)){const d=distance(s,sun)||1;game.physics.sunBody.applyImpulse({x:(s.x-sun.x)/d*22*dt,y:(s.z-sun.z)/d*22*dt},true);}}
 }
 after(game,dt) {
  const sun=game.physics.snapshot().sun,flags=game.flags,states=this.states;game.beams=[];for(const s of Object.values(states))s.lit=false;
  for(const e of this.entities){const s=states[e.id],ignore=new Set([`machine-${e.id}`,e.propId]);
   s.powered=s.energizedUntil>game.time||(game.sun?.radiance??100)>0&&distance(s,sun)<(game.sun?.radius||18)&&game.physics.lineOfSight(sun,s,ignore);
   s.driven=this.entities.some(source=>source.links?.includes(e.id)&&states[source.id].complete);
   if(e.requires&&!e.requires.every(id=>states[id]?.complete||flags[id])){s.powered=false;s.driven=false;}
   const operator=game.players.get(s.operator)||[...game.players.values()].find(p=>distance(p,s)<3.2&&p.interactedAt>game.time-1.2),rate=(operator?.hero==='ivo'?2:1)*(s.overdriveUntil>game.time&&s.powered?3:1);
   if(e.type==='plate'){
    const bodies=[...game.players.values(),...game.physics.snapshot().props,sun];s.active=bodies.filter(b=>distance(b,s)<(e.radius||1.5)).length>=(e.count||1);s.complete=s.active;
   }else if(e.type==='counterweightLift'){
    if(s.complete&&e.destination)continue;
    const tray=e.tray?{x:e.tray[0],z:e.tray[1]}:s;
    const mass=game.physics.snapshot().props.filter(p=>!p.carriedBy&&distance(p,tray)<(e.radius||3)&&(!e.cargo||e.cargo.includes(p.id))).length*1.2+(e.tray?0:distance(sun,s)<2?4:0);
    s.mass=mass;s.balanced=mass>=(e.mass||2.4)&&mass<=(e.maxMass||Infinity);
    s.active=s.balanced&&(!e.destination||distance(sun,s)<(e.captureRadius||3)||s.progress>0&&s.progress<1);
    if(e.requires&&!e.requires.every(id=>states[id]?.complete||flags[id]))s.active=false;
    if(s.active&&e.destination){s.carryFrom??={x:sun.x,z:sun.z};s.progress=Math.min(1,s.progress+dt*(e.speed||.08));game.physics.sunBody.setTranslation({x:s.carryFrom.x+(e.destination[0]-s.carryFrom.x)*s.progress,y:s.carryFrom.z+(e.destination[1]-s.carryFrom.z)*s.progress},true);game.physics.sunBody.setLinvel({x:0,y:0},true);}else s.progress=Math.max(0,Math.min(1,s.progress+dt*(s.active?.4:-.2)*rate));
    s.complete=s.progress>=.999;if(s.complete&&e.destination){s.active=false;game.teamwork(15);}
   }else if(e.type==='crane'&&s.active&&e.destination){
    s.progress=Math.min(1,s.progress+dt*.18*rate);const d=e.destination,from=s.carryFrom||s;game.physics.sunBody.setTranslation({x:from.x+(d[0]-from.x)*s.progress,y:from.z+(d[1]-from.z)*s.progress},true);game.physics.sunBody.setLinvel({x:0,y:0},true);s.complete=s.progress===1;if(s.complete)s.active=false;
   }else if(['crank','capstan'].includes(e.type)){
    if(e.ropeRoute){for(const p of game.players.values())if(p.rope.attached&&p.rope.tension>.12){const contacts=[...new Set((p.rope.nodes||[]).map(n=>n.id))];for(const id of contacts)if(id===e.ropeRoute[s.route.length])s.route.push(id);}}
    if(e.windSeconds){s.progress=Math.min(1,s.progress+(s.active&&s.powered?dt/e.windSeconds:0));}
    else s.progress=Math.min(1,s.turns/(e.turns||3));s.complete=s.progress>=1;
   }else if(['lever','valve','sluiceGate'].includes(e.type)){s.progress=Math.max(0,Math.min(1,s.progress+dt*(s.active?1:-1)*rate));s.complete=s.progress>.95;
   }else if(['gate','drawbridge'].includes(e.type)){const open=s.driven||(s.active&&s.powered);s.progress=Math.max(0,Math.min(1,s.progress+dt*(open?.7:-.7)));s.complete=s.progress>.95;
   }else if(['mirror','prismSocket'].includes(e.type)){s.complete=s.active&&s.powered;
   }else if(e.type==='waterwheel'){s.progress=Math.min(1,s.progress+(s.driven||s.powered||s.tideUntil>game.time?dt*.4*rate:0));s.complete=s.progress>=1;
   }else if(e.type==='winch'){s.complete=s.active&&s.powered;}
   if(e.type==='cradle'&&e.chargeSeconds&&s.active&&!s.locked){
    const ready=(!e.requires||e.requires.every(id=>states[id]?.complete||flags[id]))&&distance(sun,s)<2.6;
    if(ready){
     game.physics.sunBody.setTranslation({x:s.x,y:s.z},true);
     game.physics.sunBody.setLinvel({x:0,y:0},true);
     const before=s.progress;
     s.progress=Math.min(1,s.progress+dt/e.chargeSeconds);
     // Defending the hearth is a real fight: two Shade waves rise from the dark around it while it charges.
     for(const at of [.12,.55])if(before<at&&s.progress>=at)chargeWave(game,e,s);
    }
    if(s.progress>=1){s.locked=s.complete=true;game.systems.find(a=>a.restore)?.restore(game,e);game.teamwork(25);}
   }
   if(this.blockers.has(e.id))this.blockers.get(e.id).setEnabled(s.progress<.75);
  }
  for(const e of this.entities.filter(e=>['mirror','prismSocket'].includes(e.type))){const s=states[e.id];if(!s.powered&&!s.driven)continue;for(const angle of e.outputs||[0,...(e.type==='prismSocket'?[.38]:[])])this.beam(game,s,s.angle+angle,e.range||28,0);}
  for(const e of this.entities.filter(e=>e.type==='shadowLock')){
   const s=states[e.id],statue={x:e.statue[0],z:e.statue[1]},glyph={x:e.glyph[0],z:e.glyph[1]},dx=statue.x-sun.x,dz=statue.z-sun.z,len=Math.hypot(dx,dz),g=distance(statue,glyph);
   const shadowEnd={x:statue.x+dx/(len||1)*g,z:statue.z+dz/(len||1)*g};s.aligned=len>1.5&&len<(game.sun?.radius||18)&&distance(shadowEnd,glyph)<(e.tolerance||.9)&&game.physics.lineOfSight(sun,statue,new Set([e.propId]));
   s.progress=s.aligned?Math.min(1,s.progress+dt*.4):Math.max(0,s.progress-dt*.25);
   if(s.progress>=1&&!s.complete){s.complete=true;flags[e.id]=true;if(game.recipe.mission?.secrets?.includes(e.id))game.shards=(game.shards||0)+1;game.teamwork?.(20);}
  }
  game.objectives=(game.recipe.objectives||[]).map(o=>({...o,complete:objectiveDone(o,states,flags)}));
 }
 beam(game,origin,angle,range,depth,root=origin.id) {
  if(depth>4)return;const direction={x:Math.cos(angle),z:Math.sin(angle)},end={x:origin.x+direction.x*range,z:origin.z+direction.z*range};
  const targets=this.entities.filter(e=>['mirror','prismSocket','receiver'].includes(e.type)&&e.id!==origin.id&&segmentDistance(e.p[0],e.p[1],[origin.x,origin.z],[end.x,end.z])<1.1&&((e.p[0]-origin.x)*direction.x+(e.p[1]-origin.z)*direction.z)>1.2).sort((a,b)=>distance(origin,{x:a.p[0],z:a.p[1]})-distance(origin,{x:b.p[0],z:b.p[1]}));
  const target=targets[0],dest=target?this.states[target.id]:end;
  if(!game.physics.lineOfSight(origin,dest,new Set([`machine-${origin.id}`,`machine-${target?.id}`,target?.propId]))){return;}
  game.beams.push({a:{x:origin.x,z:origin.z},b:{x:dest.x,z:dest.z},focused:true,source:origin.id,root});
  if(target){if(target.type==='receiver'){if(!target.source||target.source===root){dest.lit=true;dest.complete=dest.powered=true;dest.progress=1;}}else{dest.lit=true;if(!target.requires||target.requires.every(id=>this.states[id]?.complete||game.flags[id]))for(const angle of target.outputs||[0,...(target.type==='prismSocket'?[.38]:[])])this.beam(game,dest,dest.angle+angle,range-distance(origin,dest),depth+1,root);}}
 }
 snapshot(game){return {machines:this.states,objectives:game.objectives||[],flags:game.flags,beams:game.beams,shards:game.shards||0};}
}

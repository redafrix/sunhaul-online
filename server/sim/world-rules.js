import { inPolygon } from '../../shared/map-math.js';
import { distance } from '../../shared/rope-routing.js';
import RAPIER from '@dimforge/rapier2d-compat';
export class WorldRules {
 constructor(game){this.recipe=game.recipe;game.world={tide:0,tideRemaining:0};this.hazards=[];this.pressureSeen=new Map();
  for(const e of this.recipe.entities.filter(e=>e.type==='avalanche')){const body=game.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...e.p)),collider=game.physics.world.createCollider(RAPIER.ColliderDesc.ball(e.radius||3),body);collider.setEnabled(false);game.physics.solids.set(collider.handle,{p:{id:e.id},f:{},collider});this.hazards.push({e,body,collider});}
 }
 before(game){const tide=this.recipe.tide;if(tide){const cycle=game.time%(tide.period||100);game.world.tide=Math.max(0,Math.sin(cycle/(tide.period||100)*Math.PI*2))*(tide.height||2);game.world.tideRemaining=Math.max(0,(tide.period||100)/2-cycle);}game.world.blizzard=!!this.recipe.blizzard&&game.time%(this.recipe.blizzard.period||70)<(this.recipe.blizzard.duration||12);
  game.world.hazards=[];for(const {e,body,collider} of this.hazards){const s=game.machines[e.id],t=(game.time+(e.offset||0))%(e.period||55),warning=e.warning||3,duration=e.duration||9,stopped=game.machines[e.stop]?.complete;s.warning=t<warning&&!stopped;s.active=t>=warning&&t<warning+duration&&!stopped;s.progress=Math.max(0,Math.min(1,(t-warning)/duration));s.x=e.a[0]+(e.b[0]-e.a[0])*s.progress;s.z=e.a[1]+(e.b[1]-e.a[1])*s.progress;body.setNextKinematicTranslation({x:s.x,y:s.z});collider.setEnabled(s.active);game.world.hazards.push({id:e.id,x:s.x,z:s.z,radius:e.radius||3,active:s.active,warning:s.warning});}
 }
 after(game,dt){const r=this.recipe,sun=game.physics.snapshot().sun;
  for(const e of r.entities.filter(e=>e.type==='coolingChannel')){const s=game.machines[e.id];s.flow=(e.requires||[]).every(id=>game.machines[id]?.complete||game.flags[id]);if(!s.complete&&s.flow)s.progress=Math.min(1,s.progress+dt/(e.seconds||12));if(s.progress>=1&&!s.complete){s.complete=true;game.flags[e.id]=true;game.teamwork(15);}}
  for(const e of r.entities.filter(e=>e.type==='steamVent')){const s=game.machines[e.id],ready=(e.requires||[]).every(id=>game.machines[id]?.complete||game.flags[id]);s.active=ready&&game.time%(e.period||9)<(e.on||5);s.flow=s.active;}
  for(const e of r.entities.filter(e=>e.type==='sequence'&&e.pressure)){const s=game.machines[e.id];if(s.mistakeAt!==undefined&&this.pressureSeen.get(e.id)!==s.mistakeAt){this.pressureSeen.set(e.id,s.mistakeAt);game.world.pressureBurstAt=game.time;game.sun.heat=Math.min(100,(game.sun.heat||0)+12);for(const p of game.players.values())if(distance(p,s)<(e.radius||25)&&p.hero!=='brann'&&!(p.dodgeUntil>game.time)){p.hp=Math.max(0,p.hp-6);p.rope.fray=Math.min(.9,(p.rope.fray||0)+.08);}}}
  if(r.heat){const hot=(r.surfaces||[]).some(e=>e.type==='heat'&&distance(sun,{x:e.p[0],z:e.p[1]})<e.radius),vent=r.entities.some(e=>e.type==='steamVent'&&game.machines[e.id].active&&distance(sun,{x:e.p[0],z:e.p[1]})<(e.radius||7)),well=r.entities.some(e=>e.type==='well'&&distance(sun,{x:e.p[0],z:e.p[1]})<(e.radius||4)),protectedSun=[...game.players.values()].some(p=>p.hero==='brann'&&distance(p,sun)<4);
   const cooling=vent||well||game.sun.coolUntil>game.time;game.sun.heat=Math.max(0,Math.min(100,(game.sun.heat||0)+dt*(cooling?-(r.heat.cooling||16):(hot?r.heat.lavaGain||4:r.heat.gain??1)*(protectedSun?.65:1))));
   game.world.flareWarning=game.sun.heat>85;game.world.flareFor=game.world.flareWarning?(game.world.flareFor||0)+dt:0;
   if(game.world.flareFor>4){game.sun.heat=55;game.sun.radiance=Math.max(20,game.sun.radiance-20*game.rules.sunDamage*(game.difficulty==='gentle'?0:1));game.world.flareAt=game.time;game.world.flareFor=0;for(const p of game.players.values())if(distance(p,sun)<8&&p.hero!=='brann'&&!(p.heatImmuneUntil>game.time)&&!(p.shieldUntil>game.time)){p.hp=Math.max(0,p.hp-12);p.rope.fray=Math.min(.9,(p.rope.fray||0)+.18);}}
   for(const p of game.players.values())if(hot&&distance(p,sun)<8&&p.hero!=='brann'&&!(p.heatImmuneUntil>game.time)&&!(p.shieldUntil>game.time))p.hp=Math.max(0,p.hp-dt*1.5);
  }
  for(const e of r.entities.filter(e=>['vineNode','hedge'].includes(e.type))){const s=game.machines[e.id],ready=(e.requires||[]).every(id=>game.machines[id]?.complete||game.flags[id]);
   const lit=ready&&(distance(sun,s)<(e.lightRadius||game.sun.radius)&&game.physics.lineOfSight(sun,s,new Set([`machine-${e.id}`]))||game.effects.some(a=>a.until>game.time&&['grove','vinebridge','flare'].includes(a.kind)&&distance(a,s)<a.radius+3));
   if(e.type==='vineNode'){if(!s.complete)s.progress=Math.max(0,Math.min(1,s.progress+dt*(lit?1/(e.seconds||18):-.008)));if(s.progress>=1&&!s.complete){s.complete=true;game.flags[e.id]=true;game.teamwork(15);}}
   else {s.progress=Math.max(0,Math.min(1,s.progress+dt*(lit?.22:-.055)));s.complete=s.progress>=.95;if(s.complete)game.flags[e.id]=true;}
   s.lit=lit;
  }
  for(const e of r.entities.filter(e=>e.type==='loadField')){const s=game.machines[e.id],ready=(e.requires||[]).every(id=>game.machines[id]?.complete||game.flags[id]),onIce=ready&&distance(sun,s)<(e.radius||14),required=Math.min(e.supports.length,Math.max(1,[...game.players.values()].filter(p=>p.connected!==false).length-1));s.required=required;s.support=e.supports.filter(id=>game.machines[id]?.active).length;s.stress=Math.max(0,Math.min(1,(s.stress||0)+dt*(onIce&&!s.complete&&s.support<required?.1:-.18)));
   if(!s.complete){s.progress=onIce&&s.support>=required?Math.min(1,s.progress+dt/(e.seconds||8)):Math.max(0,s.progress-dt*.05);if(s.progress>=1){s.complete=true;game.flags[e.id]=true;game.teamwork(20);}}
   if(s.stress>=1){this.rescueSun(game);s.stress=0;s.progress=s.complete?1:0;s.crackedAt=game.time;}
  }
  for(const e of r.entities.filter(e=>e.type==='meltSocket')){const s=game.machines[e.id],ready=(e.requires||[]).every(id=>game.machines[id]?.complete||game.flags[id]),warm=!(game.sun.freezeUntil>game.time)||game.sun.warmUntil>game.time;
   if(!s.complete&&ready&&warm&&distance(sun,s)<(e.meltRadius||6))s.progress=Math.min(1,s.progress+dt/(e.seconds||9));
   if(s.progress>=1&&!s.complete){s.complete=true;s.open=e.hole!==false;game.flags[e.id]=true;game.teamwork(8);if(e.propId)this.removeProp(game,e.propId);}
  }
  if(r.entities.some(e=>e.type==='iceField')){for(const p of game.players.values())if(game.physics.floor(p.x,p.z)<r.water.level-.4&&!game.effects.some(e=>['icebridge','vinebridge'].includes(e.kind)&&e.until>game.time&&distance(e,p)<e.radius+5)){p.hp=Math.max(30,p.hp-20);p.fellAt=game.time;this.rescuePlayer(game,p);}
   if(game.physics.floor(sun.x,sun.z)<r.water.level-.4)this.rescueSun(game);
  }
  for(const a of game.world.hazards||[])if(a.active)for(const p of game.players.values())if(distance(p,a)<a.radius+.8&&!(p.dodgeUntil>game.time)&&game.time>=(p.avalancheHitAt||0)){p.avalancheHitAt=game.time+2;p.hp=Math.max(0,p.hp-18);p.rope.attached=false;p.hint='An avalanche! Shelter off the main pass or use the safety capstan.';}
  for(const a of r.tide?.areas||[]){if(game.world.tide<(a.floodAt||.8))continue;
   const frozen=game.effects.some(e=>['icebridge','icewall','maelstrom'].includes(e.kind)&&e.until>game.time&&distance(e,{x:a.p[0],z:a.p[1]})<(a.radius||12));
   if(frozen)continue;
   if(inPolygon(sun.x,sun.z,a.poly))game.sun.radiance=Math.max(0,game.sun.radiance-dt*1.5*game.rules.sunDamage*(game.difficulty==='gentle'?0:1));
   for(const p of game.players.values())if(inPolygon(p.x,p.z,a.poly)&&p.hero!=='nerali'){p.waterUntil=game.time+.1;if(p.rope.attached)p.rope.fray=Math.min(1,(p.rope.fray||0)+dt*.025);}
  }
 }
 removeProp(game,id){if(!game.destroyed.includes(id))game.destroyed.push(id);for(const [handle,r] of [...game.physics.solids])if(r.p.id===id){game.physics.solids.delete(handle);game.physics.world.removeCollider(r.collider,true);}game.physics.contacts=game.physics.contacts.filter(c=>c.id!==id);}
 rescuePlayer(game,p){const spawn=this.recipe.entities.find(e=>e.type==='heroSpawn')?.p||[2,2],at=game.safeSpawn?.(game.checkpoint||{x:spawn[0],z:spawn[1]})||{x:spawn[0],z:spawn[1]};p.body.setTranslation({x:at.x,y:at.z},true);p.vx=p.vz=0;p.rope.attached=false;p.cargoTow=null;p.hint='The ice gave way. The crew pulled you back to the last hearth.';game.physics.sync(p);}
 rescueSun(game){const spawn=this.recipe.entities.find(e=>e.type==='sunSpawn')?.p||[0,0],at=game.checkpoint||{x:spawn[0],z:spawn[1]};game.physics.sunBody.setTranslation({x:at.x,y:at.z},true);game.physics.sunBody.setLinvel({x:0,y:0},true);game.sun.radiance=Math.max(35,game.sun.radiance-15*game.rules.sunDamage*(game.difficulty==='gentle'?0:1));game.world.rescueAt=game.time;for(const p of game.players.values())p.rope.attached=false;}
 snapshot(game){return {world:game.world};}
}

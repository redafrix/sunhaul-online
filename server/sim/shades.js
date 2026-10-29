// Shade encounters and authoritative down/revive transitions.
import { beginAction, clearActions } from '../../shared/hero-actions.js';
import {strike,enemyStrike} from './combat.js';
import { seeded,terrainHeight,segmentDistance } from '../../shared/map-math.js';
import { distance } from '../../shared/rope-routing.js';
import RAPIER from '@dimforge/rapier2d-compat';
// Sunlight only scorches (hp/s) and exposes Shades; Keepers finish them.
const SCORCH={wisp:4,lurker:2.5,brute:3,moth:.8,weaver:3,hound:3};
const stats={wisp:{hp:30,speed:3.1,radius:.26},lurker:{hp:65,speed:3.2,radius:.48},brute:{hp:150,speed:1.6,radius:.95},moth:{hp:40,speed:3.8,radius:.3},weaver:{hp:90,speed:2.2,radius:.6},hound:{hp:42,speed:4.2,radius:.4}};
export class Shades {
 constructor(game){this.shades=[];this.deaths=[];this.webs=[];this.random=seeded(game.recipe.seed+47);this.serial=0;this.spawns=(game.recipe.shadeSpawns||[]).map(s=>({...s,next:s.delay??1}));game.shades=this.shades;game.webs=this.webs;}
 spawn(game,type,x,z,zone){const st=stats[type]||stats.wisp,hp=st.hp*(game.difficulty==='gentle'?.75:game.difficulty==='eclipse'?1.2:1),shade={id:`shade-${++this.serial}`,type,x,z,home:{x,z},hp,maxHP:hp,spawnAt:game.time,spawnUntil:game.time+1.2,vx:0,vz:0,facing:{x:0,z:1},zone,stunUntil:0,flying:type==='moth'};game.physics.addPlayer(shade,st.radius,true);shade.controller.setApplyImpulsesToDynamicBodies(false);if(type==='wisp'||type==='moth')shade.collider.setSensor(true);this.shades.push(shade);return shade;}
 command(game,p,cmd) {
  if(cmd==='attack')strike(game,p);
  if(cmd==='use'||cmd==='interact'){const ally=[...game.players.values()].find(a=>a.id!==p.id&&(!p.team||a.team===p.team)&&a.downedUntil>game.time&&distance(p,a)<2.5);if(ally){ally.hp=60;ally.downedUntil=0;clearActions(ally);beginAction(ally,'getUp','getUp',game.time);ally.shieldUntil=ally.action.until;beginAction(p,'revive','revive',game.time,p.commandSeq);game.teamwork?.(15);}}
 }
 before(game,dt) {
  const sun=game.physics.snapshot().sun,radius=game.sun?.radius||18,gentle=game.difficulty==='gentle';
  for(const spawn of this.spawns){if(game.boss?.active)continue;const zoneIndex=game.recipe.mission?.zoneOrder?.indexOf(spawn.zone)??0;if(zoneIndex>(game.restored||[]).length)continue
const opened=zoneIndex>0?game.restored?.[zoneIndex-1]?.at:undefined
if(opened!==undefined&&game.time<opened+(spawn.grace??20))continue;if((game.restored||[]).some(z=>z.id===spawn.zone)||game.time<spawn.next)continue;spawn.next=game.time+(spawn.interval||40);const count=Math.max(1,Math.ceil((spawn.count||5)*game.rules.shadeCount*(.7+.3*game.keeperCount())));for(let i=0;i<count&&this.shades.length<48;i++){const a=this.random()*Math.PI*2,r=this.random()*(spawn.radius||3),x=spawn.p[0]+Math.cos(a)*r,z=spawn.p[1]+Math.sin(a)*r;if(terrainHeight(game.recipe,x,z)>(game.recipe.water?.level??-1))this.spawn(game,game.difficulty==='eclipse'&&i%3===0?'brute':game.difficulty==='veteran'&&spawn.type==='wisp'&&i%2===0?'lurker':spawn.type,x,z,spawn.zone);}}
  if(game.sun?.radiance===0&&game.tick%180===0&&this.shades.length<48){const a=this.random()*Math.PI*2;this.spawn(game,'wisp',sun.x+Math.cos(a)*radius*1.3,sun.z+Math.sin(a)*radius*1.3);}
  for(const p of game.players.values()){p.hp??=100;if(p.hp<=0&&!(p.downedUntil>0)){p.downedUntil=game.time+(game.keeperCount()===1?3:8);p.rope.attached=false;}
   if(p.downedUntil>game.time||p.downedUntil&&game.difficulty==='eclipse'){p.input={x:0,z:0};p.vx=p.vz=0;}
   else if(p.downedUntil&&game.difficulty!=='eclipse'){const ownSun=game.sunPositionFor(p),at=game.safeSpawn(ownSun);p.body.setTranslation({x:at.x,y:at.z},true);p.hp=60;p.downedUntil=0;clearActions(p);beginAction(p,'getUp','getUp',game.time);p.shieldUntil=p.action.until;game.physics.sync(p);}
  }
  for(const s of this.shades){const nearestSun=game.recipe.mode==='sun-race'?['dawn','dusk'].map(team=>({team,...game.sunPositionFor({team})})).sort((a,b)=>distance(s,a)-distance(s,b))[0]:null,sun=nearestSun||game.sunPositionFor(),sunState=game.sunStateFor(nearestSun),radius=sunState.radius||18;if(s.hp<=0){s.vx=s.vz=0;continue;}if(s.spawnUntil>game.time){s.vx=s.vz=0;continue;}if(s.knockUntil>game.time){game.physics.move(s,{x:s.knock.x*dt,z:s.knock.z*dt});continue;}if(s.stunUntil>game.time){s.vx=s.vz=0;continue;}
   if(s.type==='weaver'&&game.time>=(s.webAt??game.time)){s.webAt=game.time+16;this.spin(game,s);}
   let target=sun;const d=distance(s,sun),players=[...game.players.values()].filter(p=>p.connected!==false&&!p.downedUntil),nearest=players.sort((a,b)=>distance(s,a)-distance(s,b))[0];
   if(s.flee?.until>game.time)target={x:s.x+(s.x-s.flee.x)*2,z:s.z+(s.z-s.flee.z)*2};
   else if(s.boss||s.wave||game.difficulty==='eclipse'&&s.type==='brute')target=sun;
   else if(s.type==='moth')target=sun;
   else if(s.type==='lurker'){
    const rope=[...game.players.values()].filter(p=>p.rope.attached).map(p=>({p,point:this.ropePoint(s,p.rope.path||[])})).sort((a,b)=>distance(s,a.point)-distance(s,b.point))[0];
    target=rope?.point||nearest||sun;
    if(rope&&distance(s,rope.point)<1.25){if(s.wasBiting&&game.time>=s.windupUntil)rope.p.rope.fray=Math.min(1,(rope.p.rope.fray||0)+dt/6*game.rules.fray);s.biting=true;}else s.biting=false;
   }else if(s.type==='hound')target=nearest||sun;
   else if(s.type==='brute')target=nearest&&distance(nearest,s.home)<12?nearest:s.home;
   else if(s.type==='wisp'&&nearest&&distance(s,nearest)<9&&d>radius*.3)target=nearest;
   else if(d<radius*.85&&sunState.radiance>25)target={x:s.x+(s.x-sun.x)*2,z:s.z+(s.z-sun.z)*2};
   else if(d>radius+1&&sunState.radiance>25)target={x:sun.x+(s.x-sun.x)/d*(radius+.8),z:sun.z+(s.z-sun.z)/d*(radius+.8)};
   enemyStrike(game,s,nearest);
   const attacking=s.strikePending||game.time<(s.windupUntil||0)+.25;
   if(attacking)target=s.attackTarget||target;
   const dx=target.x-s.x,dz=target.z-s.z,len=Math.hypot(dx,dz)||1,speed=(attacking||s.biting)?0:stats[s.type].speed*game.rules.shadeSpeed*(s.litUntil>game.time?.7:1);
   s.vx=dx/len*speed;s.vz=dz/len*speed;if(!attacking)s.facing={x:dx/len,z:dz/len};game.physics.move(s,{x:s.vx*dt,z:s.vz*dt});
   if(d<radius&&game.physics.lineOfSight(sun,s)){s.litUntil=game.time+.3;if(s.type!=='brute'||s.wave)s.hp-=dt*(s.boss?5:SCORCH[s.type]??2);}
   const bastion=game.effects?.some(e=>e.kind==='bastion'&&e.until>game.time&&distance(sun,e)<e.radius);
   if(d<2.2&&!bastion)sunState.radiance=Math.max(0,sunState.radiance-dt*(s.type==='brute'?6:3)*game.rules.sunDamage*game.rules.shadeDamage*(.8+.2*game.keeperCount())*(gentle?.35:1));
   for(const beam of game.beams||[])if(segmentDistance(s.x,s.z,[beam.a.x,beam.a.z],[beam.b.x,beam.b.z])<1.1)s.hp-=dt*(s.type==='brute'?45:65);
   for(const effect of game.effects||[])if(effect.until>game.time&&['bastion','grove'].includes(effect.kind)&&distance(s,effect)<effect.radius){s.stunUntil=game.time+.2;s.vx=s.vz=0;}
  }
  for(const w of this.webs)if(distance(w,sun)<radius&&game.physics.lineOfSight(sun,w,new Set([w.id])))w.hp-=dt*15;
 }
 spin(game,s){if(this.webs.length>=12)return;const id=`web-${++this.serial}`,x=s.x,z=s.z,c=game.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(2,.2).setTranslation(x,z)),f={id,x,z,type:'box',hx:2,hz:.2,angle:0,ropeContact:true,points:[{x:x-2,z:z-.2},{x:x+2,z:z-.2},{x:x+2,z:z+.2},{x:x-2,z:z+.2}]};game.physics.solids.set(c.handle,{p:{id,breakable:true,hp:40},f,collider:c});game.physics.contacts.push(f);this.webs.push({id,x,z,hp:40,until:game.time+24,collider:c});}
 ropePoint(s,path){let best={x:10000,z:10000},d=Infinity;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((s.x-a.x)*dx+(s.z-a.z)*dz)/(dx*dx+dz*dz||1))),p={x:a.x+dx*t,z:a.z+dz*t},dist=distance(s,p);if(dist<d){best=p;d=dist;}}return best;}
 after(game){for(let i=this.shades.length-1;i>=0;i--){const s=this.shades[i];game.physics.sync(s);if(s.hp<=0){this.deaths.push({id:s.id,type:s.type,x:s.x,z:s.z,facing:s.facing,at:game.time});game.physics.removePlayer(s);this.shades.splice(i,1);game.teamwork?.(3);}}this.deaths=this.deaths.filter(d=>game.time-d.at<2);for(let i=this.webs.length-1;i>=0;i--){const w=this.webs[i];if(w.hp<=0||w.until<game.time||game.destroyed.includes(w.id)){if(game.physics.solids.has(w.collider.handle)){game.physics.solids.delete(w.collider.handle);game.physics.world.removeCollider(w.collider,true);}game.physics.contacts=game.physics.contacts.filter(f=>f.id!==w.id);this.webs.splice(i,1);}}}
 snapshot(){return {shades:this.shades.map(({body,collider,controller,...s})=>s),shadeDeaths:this.deaths,webs:this.webs.map(({collider,...w})=>w)};}
}

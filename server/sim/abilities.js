import {nearestEnemy} from './combat.js';
import RAPIER from '@dimforge/rapier2d-compat';
import { ABILITIES } from '../../shared/heroes.js';
import { footprint } from '../../shared/physics-geometry.js';
import { distance } from '../../shared/rope-routing.js';
import { terrainHeight,segmentDistance } from '../../shared/map-math.js';
const inCone=(p,t,range,spread=.5)=>{const dx=t.x-p.x,dz=t.z-p.z,d=Math.hypot(dx,dz);return d<=range&&(d<.1||(dx*p.facing.x+dz*p.facing.z)/d>spread);};
export class Abilities {
 constructor(game){game.effects=[];game.anchors=[];game.destroyed=[];this.serial=0;this.colliders=new Map();}
 effect(game,p,spec,slot,x=p.x,z=p.z){const e={id:`ability-${++this.serial}`,owner:p.id,hero:p.hero,slot,type:spec.type,kind:spec.kind,x,z,dx:p.facing.x,dz:p.facing.z,radius:spec.radius||2,until:game.time+(spec.duration||.6),at:game.time,team:p.team,light:!!spec.light,damage:spec.damage||0,range:spec.range,permanent:!!spec.permanent};game.effects.push(e);return e;}
 command(game,p,cmd){
  const sunState=game.sunStateFor(p);
  if(cmd==='channel-stop'){const e=game.effects.find(e=>e.id===p.channel?.effect);if(e)e.until=game.time;p.channel=null;return;}
  if(cmd==='carry'&&p.hero==='brann'&&!(p.downedUntil>game.time)){this.carry(game,p);return;}
  let slot=cmd.startsWith('ability-')?cmd.slice(8).toUpperCase():null;if(cmd==='use'&&p.interactedAt!==game.time)slot='E';
  if(slot==='E'&&p.channel){this.command(game,p,'channel-stop');return;}
  const base=ABILITIES[p.hero]?.[slot],factor=game.difficulty==='gentle'?.8:game.difficulty==='eclipse'?1.15:1;
  const spec=base?{...base,cooldown:(base.cooldown||1)*factor}:null;if(!spec||p.downedUntil>game.time)return;
  p.cooldowns??={};if(p.cooldowns[slot]>game.time||slot==='R'&&(p.ultimate||0)<100)return;
  if(spec.type==='channel'&&(sunState.radiance<1||distance(p,game.sunPositionFor(p))>sunState.radius)){p.hint='Stay in the Sun’s light to channel Sunlance.';return;}
  const moment=game.recipe.powerMoments;
  const discovery=slot==='Q'&&moment&&(p.hero==='sera'&&(distance(p,{x:moment.jetty.p[0],z:moment.jetty.p[1]})<4||distance(p,{x:moment.jetty.landing[0],z:moment.jetty.landing[1]})<3)||p.hero==='brann'&&!moment.shortcut.crates.every(id=>game.destroyed.includes(id))&&distance(p,{x:moment.shortcut.p[0],z:moment.shortcut.p[1]})<7);
  if(discovery){const at=p.hero==='sera'?(p.x<-28?moment.jetty.p:moment.jetty.landing):[moment.shortcut.p[0],-44];const d=Math.hypot(at[0]-p.x,at[1]-p.z)||1;p.facing={x:(at[0]-p.x)/d,z:(at[1]-p.z)/d};}
  const target=discovery?null:nearestEnemy(game,p,spec.range||spec.radius||3);
  if(target&&['cone','dash','place','channel','beam'].includes(spec.type)){const d=distance(p,target)||1;p.facing={x:(target.x-p.x)/d,z:(target.z-p.z)/d};}
  if(slot==='R')p.ultimate=0;p.cooldowns[slot]=game.time+(spec.cooldown||1);p.castAt=game.time;p.castSlot=slot;p.hint=null;
  let x=p.x,z=p.z;if(spec.type==='place'||spec.kind==='snare'){const reach=spec.kind==='flare'?8:spec.kind==='vinebridge'||spec.kind==='icebridge'?5:3;for(let r=.5;r<=reach;r+=.5){const point={x:p.x+p.facing.x*r,z:p.z+p.facing.z*r};if(!game.physics.lineOfSight(p,point))break;x=point.x;z=point.z;}}
  const ramp=game.recipe.powerMoments?.ramp;
  const onRamp=ramp&&Math.abs(p.x-ramp.a[0])<ramp.width/2+.2&&p.z<ramp.a[1]-4&&p.z>=ramp.b[1]-3.5;
  if(spec.kind==='stake'&&onRamp){x=p.x+1;z=p.z;}
  const e=this.effect(game,p,spec,slot,x,z);
  if(discovery&&spec.kind==='smash')e.discovery=true;
  if(e.kind==='pathfinder')e.radius=Math.hypot(...game.recipe.size);
  if(spec.type==='dash'){
   if(spec.kind==='blink'){const start={x:p.x,z:p.z};game.physics.move(p,{x:p.facing.x*spec.range,z:p.facing.z*spec.range});const moved=p.controller.computedMovement();p.body.setTranslation({x:p.x+moved.x,y:p.z+moved.y},true);game.physics.sync(p);e.from=start;e.x=p.x;e.z=p.z;p.dodgeUntil=game.time+.25;}
   else {p.dash={x:p.facing.x,z:p.facing.z,speed:spec.range/.35,until:game.time+.35,damage:spec.damage||0,kind:spec.kind,hits:[]};p.dodgeUntil=game.time+.35;if(spec.kind==='grapple'){e.a={x:p.x,z:p.z};e.b={x:p.x+p.facing.x*spec.range,z:p.z+p.facing.z*spec.range};e.width=1.3;e.radius=1.6;e.ladder=true;}}
  }else if(spec.type==='place'){
   if(['stake','grove','winch'].includes(spec.kind))this.solid(game,e,{type:'circle',r:spec.kind==='grove'?.65:spec.kind==='winch'?.45:.25},true);
   if(['icebridge','vinebridge'].includes(spec.kind)){
    const a={x:e.x-e.dx*5,z:e.z-e.dz*5},b={x:e.x+e.dx*5,z:e.z+e.dz*5};e.a=a;e.b=b;e.width=1.6;
    const water=Array.from({length:11},(_,i)=>terrainHeight(game.recipe,a.x+(b.x-a.x)*i/10,a.z+(b.z-a.z)*i/10)).some(h=>h<(game.recipe.water?.level??-1)+.2);
    if(spec.kind==='icebridge'&&!water){e.kind='icewall';e.radius=3;this.solid(game,e,{type:'box',half:[3,.22]},false);}
    if(spec.kind==='icebridge'&&distance(e,game.sunPositionFor(p))<3&&!(sunState.warmUntil>game.time))sunState.freezeUntil=game.time+1.5;
   }
   if(spec.kind==='stake'&&onRamp&&p.rope.attached){p.rope.tied={id:e.id,x:e.x,z:e.z};p.rope.length=distance(e,game.sunPositionFor(p));p.hint='Ground Anchor holds the Sun. Take your rope to continue.';}
   if(spec.kind==='flare'){game.lastPing={x:e.x,z:e.z,at:game.time,flare:true};}
  }else if(spec.type==='cone')this.cone(game,p,spec,e);
  else if(spec.type==='channel')p.channel={...spec,until:e.until,effect:e.id};
  else if(spec.type==='transform'){
   p.transformUntil=e.until;p.pullMultiplier=spec.kind==='forge'?3:1;
   if(spec.kind==='forge'){p.heatImmuneUntil=e.until;p.shieldUntil=e.until;}
   if(spec.kind==='overdrive')this.effect(game,p,{type:'place',kind:'sunbot',duration:15,radius:1},null,p.x+p.facing.x*4,p.z+p.facing.z*4);
  }else if(spec.type==='beam'){
   const sun=game.sunPositionFor(p);e.x=sun.x;e.z=sun.z;e.radius=spec.radius*(distance(p,sun)<6?1.3:1);
   for(const s of game.shades||[])if(distance(s,sun)<e.radius&&game.physics.lineOfSight(sun,s)){s.hp-=s.type==='brute'?spec.damage*.4:spec.damage;s.stunUntil=game.time+4;}
  }
 }
 solid(game,e,collider,anchor){
  const angle=Math.atan2(-e.dx,e.dz)*180/Math.PI,f=footprint({id:e.id,p:[e.x,0,e.z],r:angle,s:1},{collider,ropeContact:true},.13);
  const d=collider.type==='circle'?RAPIER.ColliderDesc.ball(collider.r):RAPIER.ColliderDesc.cuboid(...collider.half).setRotation(f.angle);
  const c=game.physics.world.createCollider(d.setTranslation(e.x,e.z));this.colliders.set(e.id,c);game.physics.solids.set(c.handle,{p:{id:e.id},f,collider:c});e.solid={...collider,angle};
  if(anchor)game.anchors.push({...f,until:e.until,permanent:e.permanent});else game.physics.contacts.push(f);
 }
 knock(game,s,dx,dz,power){s.stunUntil=Math.max(s.stunUntil||0,game.time+.6);s.knock={x:dx*power,z:dz*power};s.knockUntil=game.time+.2;game.physics.move(s,{x:dx*power/60,z:dz*power/60});}
 cone(game,p,spec,e){
  const sunState=game.sunStateFor(p);
  const physics=game.physics,sun=game.sunPositionFor(p),targets=[...(game.shades||[]),...physics.snapshot().props,{...sun,sun:true}].filter(t=>inCone(p,t,spec.range)&&physics.lineOfSight(p,t,new Set([t.id]))).sort((a,b)=>distance(p,a)-distance(p,b));
  if(spec.kind==='yank'){
   const machine=game.recipe.entities.filter(m=>['lever','valve','crank','winch'].includes(m.type)&&inCone(p,{x:m.p[0],z:m.p[1]},8)&&physics.lineOfSight(p,{x:m.p[0],z:m.p[1]},new Set([`machine-${m.id}`,m.propId]))).sort((a,b)=>distance(p,{x:a.p[0],z:a.p[1]})-distance(p,{x:b.p[0],z:b.p[1]}))[0];
   if(machine){const m=game.machines[machine.id];if(!machine.requires||machine.requires.every(id=>game.machines[id]?.complete||game.flags[id])){m.operator=p.id;m.active=machine.type==='crank'?true:!m.active;if(machine.type==='crank')m.turns++;game.teamwork(2);e.target={x:m.x,z:m.z};}return;}
   const t=targets.find(t=>!t.sun);if(t){const d=distance(p,t)||1,dx=(p.x-t.x)/d,dz=(p.z-t.z)/d,s=game.shades.find(s=>s.id===t.id);e.target={x:t.x,z:t.z};if(s){s.hp-=spec.damage;this.knock(game,s,dx,dz,12);}else physics.props.get(t.id)?.body.applyImpulse({x:dx*18,y:dz*18},true);}return;
  }
  for(const t of targets){const d=distance(p,t)||1,dx=(t.x-p.x)/d,dz=(t.z-p.z)/d,s=game.shades.find(s=>s.id===t.id),power=spec.kind==='smash'?30:24;
   if(s){s.hp-=(spec.damage||0)*(s.type==='brute'?.5:1);this.knock(game,s,dx,dz,power*.5);}
   (t.sun&&(e.discovery||game.boss?.kind==='drownedKing'&&game.boss.active)?null:t.sun?game.sunBodyFor(p):physics.props.get(t.id)?.body)?.applyImpulse({x:dx*power,y:dz*power},true);
  }
  if(spec.kind==='tide'){
   if(inCone(p,sun,8)){sunState.coolUntil=game.time+6;sunState.radiance=Math.min(100,sunState.radiance+3);}
   for(const effect of game.effects)if(effect.kind==='firetrail'&&inCone(p,effect,8))effect.until=game.time;
   for(const m of Object.values(game.machines))if(m.type==='waterwheel'&&inCone(p,m,8))m.tideUntil=game.time+4;
  }
  if(spec.kind==='gust')for(const ally of game.players.values())if(ally.hero==='asha'&&inCone(p,ally,8))ally.gustUntil=game.time+2;
  if(spec.kind==='smash')this.breakProps(game,p,4,40,e);
 }
 breakProps(game,p,range,damage,e){
  for(const [handle,r]of [...game.physics.solids])if(r.p.breakable&&inCone(p,r.f,range)&&game.physics.lineOfSight(p,r.f,new Set([r.p.id]))){r.hp=(r.hp??r.p.hp??40)-damage;if(r.hp>0)continue;game.destroyed.push(r.p.id);game.physics.solids.delete(handle);game.physics.world.removeCollider(r.collider,true);game.physics.contacts=game.physics.contacts.filter(c=>c.id!==r.p.id);game.physics.props.delete(r.p.id);e.debris??=[];e.debris.push({x:r.f.x,z:r.f.z});game.teamwork(4);}
 }
 carry(game,p){
  if(p.carry){this.drop(game,p);return;}
  const ally=[...game.players.values()].filter(a=>(!p.team||a.team===p.team)&&a.id!==p.id&&a.downedUntil>game.time&&!a.carriedBy&&distance(p,a)<2.5).sort((a,b)=>distance(p,a)-distance(p,b))[0];
  const crate=[...game.physics.props.values()].filter(r=>!r.carriedBy&&distance(p,{x:r.body.translation().x,z:r.body.translation().y})<2.5).sort((a,b)=>distance(p,{x:a.body.translation().x,z:a.body.translation().y})-distance(p,{x:b.body.translation().x,z:b.body.translation().y}))[0];
  if(ally){ally.carriedBy=p.id;ally.collider.setEnabled(false);p.carry={type:'player',id:ally.id};}else if(crate){crate.carriedBy=p.id;crate.collider.setEnabled(false);p.carry={type:'prop',id:crate.p.id};}
 }
 drop(game,p){const c=p.carry;if(!c)return;const entity=c.type==='prop'?game.physics.props.get(c.id):game.players.get(c.id);if(entity){entity.carriedBy=null;entity.collider.setEnabled(true);entity.body.setTranslation({x:p.x+p.facing.x*1.6,y:p.z+p.facing.z*1.6},true);}p.carry=null;}
 before(game,dt){
  const expired=game.effects.filter(e=>['icebridge','vinebridge','grapple'].includes(e.kind)&&e.until<=game.time&&e.until>game.time-dt-.001);
  for(const p of game.players.values())if(expired.some(e=>e.a&&e.b&&segmentDistance(p.x,p.z,[e.a.x,e.a.z],[e.b.x,e.b.z])<(e.width||1.6)/2)&&terrainHeight(game.recipe,p.x,p.z)<(game.recipe.water?.level??-1)-.15){const spawn=game.recipe.entities.find(e=>e.type==='heroSpawn')?.p||[2,2],safe=game.safeSpawn?.(game.checkpoint||{x:spawn[0],z:spawn[1]})||{x:spawn[0],z:spawn[1]};p.body.setTranslation({x:safe.x,y:safe.z},true);game.physics.sync(p);p.vx=p.vz=0;p.rope.attached=false;p.hint='The crossing faded. You are back on safe ground.';}
  game.effects=game.effects.filter(e=>e.until>game.time||e.permanent);for(const e of game.effects)if(e.until<=game.time)e.light=false;game.anchors=game.anchors.filter(a=>a.permanent||a.until>game.time);
  for(const [id,c]of this.colliders)if(!game.effects.some(e=>e.id===id)){game.physics.solids.delete(c.handle);game.physics.world.removeCollider(c,true);game.physics.contacts=game.physics.contacts.filter(f=>f.id!==id);this.colliders.delete(id);}
  for(const p of game.players.values()){
   const sun=game.sunPositionFor(p),sunState=game.sunStateFor(p);
   if(p.transformUntil<=game.time)p.pullMultiplier=1;
   if(p.rope.attached&&!p.rope.tied&&p.rope.tension>.18)p.ultimate=Math.min(100,(p.ultimate||0)+dt*(p.rope.tangle?1:4));
   if(p.channel?.until<=game.time)p.channel=null;
   if(p.carry&&(p.hero!=='brann'||p.downedUntil>game.time||p.connected===false))this.drop(game,p);
   p.speedBoost=(p.gustUntil>game.time||game.effects.some(e=>(!p.team||e.team===p.team)&&e.kind==='pathfinder'&&e.until>game.time))?game.time+.1:0;
   p.waterUntil=game.effects.some(e=>e.kind==='maelstrom'&&e.until>game.time&&distance(p,e)<e.radius)?game.time+.1:0;
   if(p.hero==='oren'&&distance(p,sun)<sunState.radius&&game.physics.lineOfSight(sun,p)){
    for(const a of game.players.values())if((!p.team||a.team===p.team)&&!(a.downedUntil>game.time)&&distance(a,p)<6)a.hp=Math.min(100,(a.hp??100)+dt*2);
    sunState.radiance=Math.min(100,sunState.radiance+dt*.5);
    if(Math.hypot(p.vx,p.vz)>.5&&game.time>=(p.flowerAt||0)){this.effect(game,p,{type:'place',kind:'flowers',radius:.25,duration:3},null);p.flowerAt=game.time+.45;}
   }
  }
 }
 forces(game,dt){
  for(const e of game.effects){if(e.until<=game.time)continue;const owner=game.players.get(e.owner),sun=game.sunPositionFor(owner);
   if(e.kind==='sunbot'&&owner){e.x=owner.x+owner.facing.x*3;e.z=owner.z+owner.facing.z*3;}
   if(['winch','sunbot'].includes(e.kind)){const d=distance(e,sun)||1;if(d<15&&game.physics.lineOfSight(e,sun,new Set([e.id])))game.sunBodyFor(owner).applyImpulse({x:(e.x-sun.x)/d*25*dt,y:(e.z-sun.z)/d*25*dt},true);}
   if(e.kind==='maelstrom')for(const s of game.shades)if(distance(e,s)<e.radius){const dx=e.x-s.x,dz=e.z-s.z,d=Math.hypot(dx,dz)||1;game.physics.move(s,{x:(dx/d*2-dz/d)*dt,z:(dz/d*2+dx/d)*dt});}
  }
 }
 lightBeam(game,p,origin,angle,range){
  const machines=game.systems.find(s=>s.beam);const start=game.beams.length;machines?.beam(game,origin,angle,range,0);
  for(const beam of game.beams.slice(start)){beam.hero=p.hero;beam.owner=p.id;for(const s of game.shades)if(segmentDistance(s.x,s.z,[beam.a.x,beam.a.z],[beam.b.x,beam.b.z])<1.1)s.hp-=this.dt*(origin.damage||35)*(p.hero==='elian'&&distance(p,game.sunPositionFor(p))<6?1.3:1);}
 }
 after(game,dt){
  this.dt=dt;
  for(const p of game.players.values()){
   const sun=game.sunPositionFor(p),sunState=game.sunStateFor(p);
   if(p.channel&&sunState.radiance>0&&distance(p,sun)<sunState.radius&&game.physics.lineOfSight(sun,p)){sunState.radiance=Math.max(0,sunState.radiance-p.channel.cost*dt);this.lightBeam(game,p,{x:p.x,z:p.z,damage:p.channel.damage},Math.atan2(p.facing.z,p.facing.x),p.channel.range);}
   if(p.dash?.until>game.time&&p.dash.kind==='bash'){
    for(const s of game.shades)if(distance(p,s)<2.6&&!p.dash.hits.includes(s.id)){p.dash.hits.push(s.id);s.hp-=p.dash.damage;this.knock(game,s,p.dash.x,p.dash.z,14);}
    for(const [id,r]of game.physics.props)if(distance(p,{x:r.body.translation().x,z:r.body.translation().y})<2&&!p.dash.hits.includes(id)){p.dash.hits.push(id);r.body.applyImpulse({x:p.dash.x*20,y:p.dash.z*20},true);}
    this.breakProps(game,p,2,24,{debris:[]});
   }
   if(p.carry){const carried=p.carry.type==='prop'?game.physics.props.get(p.carry.id):game.players.get(p.carry.id);if(!carried){p.carry=null;continue;}const x=p.x+p.facing.x*.9,z=p.z+p.facing.z*.9;carried.body.setTranslation({x,y:z},true);if(p.carry.type==='prop')carried.body.setLinvel({x:0,y:0},true);else {carried.downedUntil=game.time+8;game.physics.sync(carried);if(distance(p,sun)<3.5){carried.hp=60;carried.downedUntil=0;carried.carriedBy=null;carried.collider.setEnabled(true);p.carry=null;game.teamwork(15);}}}
  }
  game.routeHints=[];
  for(const e of game.effects){if(e.until<=game.time)continue;const owner=game.players.get(e.owner);if(!owner)continue;const sun=game.sunPositionFor(owner),sunState=game.sunStateFor(owner);
   if(['overdrive','forge','embershield','tempest'].includes(e.kind)){e.x=owner.x;e.z=owner.z;e.dx=owner.facing.x;e.dz=owner.facing.z;}
   if(e.kind==='prism'&&distance(e,sun)<sunState.radius&&game.physics.lineOfSight(sun,e)){this.lightBeam(game,owner,e,Math.atan2(e.dz,e.dx)-.22,24);this.lightBeam(game,owner,e,Math.atan2(e.dz,e.dx)+.22,24);}
   if(['grove','bastion'].includes(e.kind)){
    for(const p of game.players.values())if((!owner.team||p.team===owner.team)&&distance(p,e)<e.radius){p.shieldUntil=game.time+.1;if(e.kind==='grove'&&!(p.downedUntil>game.time))p.hp=Math.min(100,(p.hp??100)+dt*8);}
    if(e.kind==='grove'&&distance(sun,e)<e.radius)sunState.radiance=Math.min(100,sunState.radiance+dt*5);
   }
   if(e.kind==='embershield'){owner.frontShieldUntil=game.time+.1;if(distance(sun,e)<3){sunState.warmUntil=game.time+.1;sunState.freezeUntil=0;}}
   if(e.kind==='pathfinder'&&game.guidance)game.routeHints=game.guidance.route;
   if(e.kind==='overdrive')for(const s of Object.values(game.machines))if(distance(s,e)<15)s.overdriveUntil=game.time+.1;
   if(e.kind==='forge'){
    for(const p of game.players.values())if(!owner.team||p.team===owner.team)p.heatImmuneUntil=game.time+.1;
    if(game.time>=(owner.fireAt||0)){this.effect(game,owner,{type:'place',kind:'firetrail',radius:.8,duration:1.5,damage:18},null);owner.fireAt=game.time+.35;}
   }
   if(e.kind==='tempest'&&game.time>=(e.strikeAt||0)){
    e.strikeAt=game.time+.5;e.links=[];let point=e;const remaining=game.shades.filter(s=>distance(s,e)<e.radius),hit=new Set();for(let i=0;i<5;i++){const target=remaining.filter(s=>!hit.has(s.id)&&distance(s,point)<(i?7:e.radius)&&game.physics.lineOfSight(point,s)).sort((a,b)=>distance(a,point)-distance(b,point))[0];if(!target)break;e.links.push({a:{x:point.x,z:point.z},b:{x:target.x,z:target.z}});target.hp-=25;target.stunUntil=game.time+.3;hit.add(target.id);point=target;}
    for(const m of Object.values(game.machines))if(distance(m,e)<15&&(/tesla|electric/.test(m.type)||game.recipe.entities.find(a=>a.id===m.id)?.power==='electric'))m.energizedUntil=game.time+1;
   }
   for(const s of game.shades)if(distance(s,e)<e.radius){
    if(['snare','maelstrom'].includes(e.kind))s.stunUntil=game.time+.1;
    if(e.kind==='flare'&&s.type==='wisp'){s.flee={x:e.x,z:e.z,until:game.time+.2};}
    if(['snare','maelstrom','firetrail'].includes(e.kind))s.hp-=dt*e.damage;
   }
  }
 }
 snapshot(game){return {effects:game.effects,anchors:game.anchors,destroyed:game.destroyed,routeHints:game.routeHints||[]};}
}

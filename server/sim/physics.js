import RAPIER from '@dimforge/rapier2d-compat';
import { placements,footprint } from '../../shared/physics-geometry.js';
import { terrainHeight } from '../../shared/map-math.js';
import { terrainAt,STEP } from '../../shared/movement.js';
import { onCrossing } from '../../shared/hero-effects.js';
import { worldHeight } from '../../shared/world-math.js';
await RAPIER.init();
export class Physics {
 constructor(recipe,catalog) {
  this.recipe=recipe;this.catalog=catalog;this.world=new RAPIER.World({x:0,y:0});this.world.timestep=STEP;
  this.props=new Map();this.contacts=[];this.chunks=new Map();this.solids=new Map();
  for(const p of placements(recipe)) {
   const a=catalog[p.a];if(!a||a.collider.type==='none'||p.collide===false)continue;
   const f=footprint(p,a,.13),key=`${Math.floor(f.x/32)},${Math.floor(f.z/32)}`;
   let body;if(f.dynamic){body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(f.x,f.z).setRotation(f.angle).setLinearDamping(4).setAngularDamping(5).setCcdEnabled(true));}
   else {if(!this.chunks.has(key))this.chunks.set(key,this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));body=this.chunks.get(key);}
   const desc=f.type==='circle'?RAPIER.ColliderDesc.ball(f.r):RAPIER.ColliderDesc.cuboid(f.hx,f.hz);
   if(!f.dynamic)desc.setTranslation(f.x,f.z).setRotation(f.angle);
   const collider=this.world.createCollider(desc.setMass(f.dynamic?1.2:0).setFriction(.6),body);
   const record={p,a,f,body,collider};this.solids.set(collider.handle,record);
   if(f.dynamic)this.props.set(p.id,record);else if(f.ropeContact)this.contacts.push(f);
  }
  const [w,h]=recipe.size;
  for(const [x,z,hx,hz]of [[-w/2-1,0,1,h/2],[w/2+1,0,1,h/2],[0,-h/2-1,w/2,1],[0,h/2+1,w/2,1]])this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hz).setTranslation(x,z));
  const spawn=recipe.entities.find(e=>e.type==='sunSpawn')?.p||[0,0];
  this.sunBody=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...spawn).setLinearDamping(2.4).setAngularDamping(2).setCcdEnabled(true));
  this.sunCollider=this.world.createCollider(RAPIER.ColliderDesc.ball(1.15).setMass(4).setFriction(.5).setRestitution(.08),this.sunBody);
  this.sunBodies={dawn:this.sunBody};
  const rival=recipe.entities.find(e=>e.type==='raceSun');if(rival){const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...rival.p).setLinearDamping(2.4).setCcdEnabled(true));this.rivalCollider=this.world.createCollider(RAPIER.ColliderDesc.ball(1.15).setMass(4).setFriction(.5),body);this.sunBodies.dusk=body;}
  this.world.step();
 }
 addPlayer(player,radius=.38,shade=false) {
  player.body=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(player.x,player.z));
  player.collider=this.world.createCollider(RAPIER.ColliderDesc.ball(radius).setMass(1).setCollisionGroups(shade?0x00040007:0x00020005),player.body);
  player.controller=this.world.createCharacterController(.02);player.controller.setSlideEnabled(true);player.controller.setMaxSlopeClimbAngle(Math.PI);player.controller.setMinSlopeSlideAngle(Math.PI);player.controller.setApplyImpulsesToDynamicBodies(true);player.controller.setCharacterMass(1);
 }
 removePlayer(p) {this.world.removeCharacterController(p.controller);this.world.removeRigidBody(p.body);}
 move(p,delta) {
  const from=p.body.translation(),wanted={x:from.x+delta.x,z:from.y+delta.z};
  const h=this.floor(wanted.x,wanted.z),previous=this.floor(from.x,from.y);
  const bridge=this.game?.effects?.some(e=>onCrossing(e,wanted.x,wanted.z,this.game.time));
  if(!p.flying&&!bridge&&(h<(this.recipe.water?.level??-1)-.15||h-previous>1.4)){
   if(this.floor(wanted.x,from.y)<(this.recipe.water?.level??-1)-.15)delta.x=0;
   if(this.floor(from.x,wanted.z)<(this.recipe.water?.level??-1)-.15)delta.z=0;
   if(h-previous>1.4)delta={x:0,z:0};
  }
  p.controller.computeColliderMovement(p.collider,{x:delta.x,y:delta.z},RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,p.collider.collisionGroups());
  const moved=p.controller.computedMovement();p.body.setNextKinematicTranslation({x:from.x+moved.x,y:from.y+moved.y});
 }
 step(dt=STEP) {
  for(const [team,body]of Object.entries(this.sunBodies)){const p=body.translation(),eps=.4;
  const dx=(this.floor(p.x+eps,p.y)-this.floor(p.x-eps,p.y))/(2*eps),dz=(this.floor(p.x,p.y+eps)-this.floor(p.x,p.y-eps))/(2*eps);
  body.applyImpulse({x:-dx*5*dt,y:-dz*5*dt},true);
  if(this.game?.mutators.includes('wind-storm')){const t=this.game.time,sign=this.recipe.mode==='sun-race'&&team==='dusk'?-1:1;body.applyImpulse({x:Math.sin(t*.4)*1.8*dt*sign,y:Math.cos(t*.27)*1.8*dt*sign},true);}
  const state=this.game?.sunStateFor({team}),surface=terrainAt(this.recipe,p.x,p.y),frozen=state?.freezeUntil>this.game?.time&&!(state?.warmUntil>this.game?.time);body.setLinearDamping(frozen?12:surface==='ice'?.55:surface==='mud'?4.5:surface==='water'?3.8:2.4);}
  this.world.step();
 }
 floor(x,z){return worldHeight(this.recipe,x,z,this.game?.machines);}
 sync(p) {const t=p.body.translation();p.x=t.x;p.z=t.y;}
 lineOfSight(a,b,ignore=new Set()) {
  const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);if(d<.01)return true;
  const hit=this.world.castRay(new RAPIER.Ray({x:a.x,y:a.z},{x:dx/d,y:dz/d}),d-.1,true,undefined,undefined,undefined,this.sunBody,c=>this.solids.has(c.handle)&&!ignore.has(this.solids.get(c.handle).p.id));return !hit;
 }
 snapshot() {
  const t=this.sunBody.translation(),v=this.sunBody.linvel();
  return {sun:{x:t.x,z:t.y,vx:v.x,vz:v.y},props:[...this.props].map(([id,r])=>{const p=r.body.translation();return {id,x:p.x,z:p.y,angle:r.body.rotation(),asset:r.p.a,s:r.p.s,carriedBy:r.carriedBy||null};})};
 }
 clearSpawn(p) {
  for(const {collider} of this.solids.values()) {
   if(!collider.isValid())continue;
   const projection=collider.projectPoint({x:p.x,y:p.z},true);
   if(projection.isInside||Math.hypot(projection.point.x-p.x,projection.point.y-p.z)<.48)return false;
  }
  return true;
 }
 free(){this.world.free();}
}

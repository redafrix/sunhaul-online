import { randomUUID } from 'node:crypto';
import { SKINS } from '../../shared/cosmetics.js';
import { Physics } from './physics.js';
import { Ropes } from './ropes.js';
import { SunSystems } from './sun.js';
import { Machines } from './machines.js';
import { Mission } from './mission.js';
import { Bots } from './bots.js';
import { Abilities } from './abilities.js';
import { HEROES } from '../../shared/abilities.js';
import { Shades } from './shades.js';
import { Puzzles } from './puzzles.js';
import { WorldRules } from './world-rules.js';
import { Bosses } from './bosses.js';
import { moveVelocity,STEP } from '../../shared/movement.js';
import { Modes } from './modes.js';
import { Guidance } from './guidance.js';
import { TEAMS } from '../../shared/modes.js';
import { configuredRecipe,rulesFor } from '../../shared/rules.js';
export class Game {
 constructor(recipe,catalog,options={}){this.runId=randomUUID();this.baseRecipe=recipe;this.rules=rulesFor(options.difficulty,options.mutators);this.mutators=this.rules.mutators;this.recipe=recipe=configuredRecipe(recipe,this.mutators);this.catalog=catalog;this.difficulty=this.rules.id;this.teamSize=Math.max(1,Math.min(4,Math.floor(Number(options.teamSize))||1));this.physics=new Physics(recipe,catalog);this.players=new Map();this.time=0;this.tick=0;this.systems=[new Ropes(),new SunSystems()];this.sun=this.systems[1].state;this.sunStates={dawn:this.sun,dusk:{...this.sun}};this.physics.sunCollider.setMass(this.rules.sunMass);if(this.physics.rivalCollider)this.physics.rivalCollider.setMass(this.rules.sunMass);for(const body of Object.values(this.physics.sunBodies))body.recomputeMassPropertiesFromColliders();this.systems.push(new Machines(this),new Puzzles(this),new Abilities(this),new Shades(this),new WorldRules(this),new Bosses(this));this.physics.game=this;this.systems.unshift(new Bots(this));this.systems.push(new Mission(this),new Guidance(),new Modes(this));}
 keeperCount(team){return Math.max(1,[...this.players.values()].filter(p=>p.connected!==false&&(!team||p.team===team)).length);}
 sunBodyFor(p){return this.physics.sunBodies?.[p?.team]||this.physics.sunBody;}
 sunStateFor(p){return this.recipe.mode==='sun-race'?this.sunStates[p?.team||'dawn']:this.sun;}
 sunPositionFor(p){const body=this.sunBodyFor(p),t=body.translation(),v=body.linvel();return {x:t.x,z:t.y,vx:v.x,vz:v.y};}
 addPlayer(id,options={}) {
  const counts=TEAMS.map(t=>[...this.players.values()].filter(p=>p.team===t).length),team=this.recipe.mode==='sun-race'?(TEAMS.includes(options.team)?options.team:counts[0]<=counts[1]?'dawn':'dusk'):null;
  const s=this.recipe.entities.find(e=>e.type==='heroSpawn'&&(!team||e.team===team))?.p||[2,2],seat=this.players.size;
  const p={id,name:typeof options.name==='string'?options.name.slice(0,18):'Keeper',hero:typeof options.hero==='string'&&Object.hasOwn(HEROES,options.hero)?options.hero:'mara',bot:!!options.bot,x:s[0]+seat%3*.85,z:s[1]+Math.floor(seat/3)*.9,vx:0,vz:0,facing:{x:0,z:-1},time:this.time,ack:0,input:{x:0,z:0,sprint:false},commands:[],rope:{attached:false,tension:0},dodgeReady:0,ultimate:0,hp:100,cooldowns:{}};
  p.team=team;const sun=this.sunPositionFor(p),spot=['w1m1','twin-docks','last-light-harbour'].includes(this.recipe.id)||this.time>1?this.safeSpawn(sun):{x:p.x,z:p.z};p.x=spot.x;p.z=spot.z;const d=Math.hypot(sun.x-p.x,sun.z-p.z)||1;p.facing={x:(sun.x-p.x)/d,z:(sun.z-p.z)/d};p.skin=Object.hasOwn(SKINS,options.skin)?options.skin:'original';this.physics.addPlayer(p);this.players.set(id,p);return p;
 }
 removePlayer(id){const p=this.players.get(id);if(p){for(const s of this.systems)s.drop?.(this,p);this.physics.removePlayer(p);this.players.delete(id);}}
 input(id,data) {
  const p=this.players.get(id);if(!p||!Number.isSafeInteger(data?.seq)||data.seq<=p.ack)return;
  p.input={x:Number.isFinite(data.x)?Math.max(-1,Math.min(1,data.x)):0,z:Number.isFinite(data.z)?Math.max(-1,Math.min(1,data.z)):0,sprint:!!data.sprint,fx:Number.isFinite(data.fx)?data.fx:0,fz:Number.isFinite(data.fz)?data.fz:0};p.ack=data.seq;p.lastInput=this.time;
  if(Array.isArray(data.commands))p.commands.push(...data.commands.filter(c=>typeof c==='string').slice(0,8));p.commands=p.commands.slice(-16);
 }
 step(dt=STEP) {
  this.time+=dt;this.tick++;if(this.failed||this.modeState.phase==='finished'||this.mission.complete)return;
  if(this.modeState.phase==='waiting'){this.systems.at(-1).before(this,dt);if(this.modeState.phase==='waiting')return;}
  for(const system of this.systems)system.before?.(this,dt);
  for(const p of this.players.values()) {
   p.time=this.time;if(this.time-(p.lastInput??0)>.3&&!p.bot)p.input={x:0,z:0,sprint:false};
   const aim=Math.hypot(p.input.fx||0,p.input.fz||0);if(aim>.1)p.facing={x:p.input.fx/aim,z:p.input.fz/aim};
   for(const command of p.commands.splice(0))this.command(p,command);
   if(p.carriedBy)continue;
   const delta=moveVelocity(p,p.input,this.recipe,dt);if(p.dash?.until>this.time){delta.x=p.dash.x*p.dash.speed*dt;delta.z=p.dash.z*p.dash.speed*dt;}if(p.strikeLunge?.until>this.time){delta.x+=p.strikeLunge.x*dt;delta.z+=p.strikeLunge.z*dt;}if(p.downedUntil>this.time||p.downedUntil&&this.difficulty==='eclipse')delta.x=delta.z=0;this.physics.move(p,delta);
  }
  for(const system of this.systems)system.forces?.(this,dt);
  this.physics.step(dt);for(const p of this.players.values())this.physics.sync(p);
  for(const system of this.systems)system.after?.(this,dt);
  if(this.rules.night&&this.recipe.mode!=='sun-race'&&!this.mission.complete){const elapsed=this.recipe.mode==='last-light'?this.time-(this.modeState.waveStartedAt||this.time):this.time,limit=this.recipe.mode==='last-light'?180:Math.max(300,this.recipe.mission?.par*1.5||this.rules.night);this.nightRemaining=Math.max(0,limit-elapsed);if(!this.nightRemaining){this.failed=true;this.failureReason='The Eclipse night timer ran out.';}}
  if(this.failed&&this.recipe.mode==='last-light')this.modeState.phase='finished';
 }
 command(p,command) {
  if(p.downedUntil&&this.difficulty==='eclipse')return;
  if(command==='emote'&&this.time>=(p.emoteReady||0)){p.emoteAt=this.time;p.emoteReady=this.time+4;}
  if(command==='dodge'&&this.time>=p.dodgeReady){p.dodgeUntil=this.time+.35;p.dodgeReady=this.time+3;}
  for(const system of this.systems)system.command?.(this,p,command);
 }
 teamwork(amount){for(const p of this.players.values())if(p.connected!==false)p.ultimate=Math.min(100,(p.ultimate||0)+amount);}
 snapshot() {return {runId:this.runId,tick:this.tick,time:this.time,rules:this.rules,nightRemaining:this.nightRemaining,failureReason:this.failureReason,...this.physics.snapshot(),players:[...this.players.values()].map(({body,collider,controller,input,commands,...p})=>p),...Object.assign({},...this.systems.map(s=>s.snapshot?.(this)||{}))};}
}

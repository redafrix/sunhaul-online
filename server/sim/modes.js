import RAPIER from '@dimforge/rapier2d-compat';
import { distance } from '../../shared/rope-routing.js';
import { segmentDistance } from '../../shared/map-math.js';
import { TEAMS } from '../../shared/modes.js';
export class Modes {
 constructor(game){
  this.kind=game.recipe.mode||'expedition';this.state={kind:this.kind,phase:this.kind==='sun-race'?'waiting':'intermission',wave:0,score:0,nextAt:12,towers:[],walls:[],shrines:[],remaining:480,progress:{dawn:0,dusk:0},winner:null};
  if(this.kind==='last-light'){
   this.state.towers=game.recipe.entities.filter(e=>e.type==='modeTower').map(e=>({id:e.id,x:e.p[0],z:e.p[1],lit:false,fuel:0}));
   this.state.walls=game.recipe.entities.filter(e=>e.type==='modeWall').map(e=>{const c=game.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(2,.2).setTranslation(...e.p).setRotation(e.rotation||0));return {id:e.id,x:e.p[0],z:e.p[1],hp:100,collider:c};});
  }
  if(this.kind==='sun-race')this.state.shrines=game.recipe.entities.filter(e=>e.type==='raceShrine').map(e=>({id:e.id,x:e.p[0],z:e.p[1],buff:e.buff,owner:null,readyAt:0}));
  game.modeState=this.state;
 }
 command(game,p,cmd){
  if(this.state.phase==='finished'||p.downedUntil>game.time)return;
  if(this.kind==='last-light'&&['interact','use'].includes(cmd)){
   const tower=this.state.towers.find(t=>distance(p,t)<3.2&&distance(game.sunPositionFor(p),t)<3.5);
   if(tower){tower.lit=true;tower.fuel=100;game.sun.radiance=Math.min(100,game.sun.radiance+25);p.interactedAt=game.time;p.hint='Tower relit: its light burns Shades and protects the hearth.';return;}
   const wall=this.state.walls.find(w=>distance(p,w)<3.2);if(wall&&this.state.phase==='intermission'){wall.hp=100;wall.collider.setEnabled(true);p.interactedAt=game.time;p.hint='Wall repaired for the next wave.';}
  }
  if(this.kind!=='sun-race'||this.state.phase!=='racing')return;
  if(['use','interact'].includes(cmd)){
   const shrine=this.state.shrines.find(s=>distance(p,s)<3.2&&game.time>=s.readyAt);
   if(shrine){shrine.owner=p.team;shrine.readyAt=game.time+35;for(const ally of game.players.values())if(ally.team===p.team){ally[shrine.buff==='haul'?'haulUntil':'wardUntil']=game.time+20;ally.ultimate=Math.min(100,ally.ultimate+15);}p.interactedAt=game.time;p.hint=shrine.buff==='haul'?'Crew haul boosted for 20 seconds.':'Crew ropes warded for 20 seconds.';}
  }
 }
 strike(game,p){
  if(this.kind!=='sun-race')return;
  if(game.time>=(p.cutReady||0)){
   p.cutReady=game.time+1.2;
   for(const enemy of game.players.values())if(enemy.team!==p.team&&enemy.rope.attached&&!(enemy.wardUntil>game.time)){
    const path=enemy.rope.path||[];if(path.slice(1).some((b,i)=>segmentDistance(p.x,p.z,[path[i].x,path[i].z],[b.x,b.z])<2.3&&game.physics.lineOfSight(p,b))){enemy.rope.attached=false;enemy.rope.tension=0;enemy.rope.cutUntil=game.time+2;p.ultimate=Math.min(100,p.ultimate+8);p.hint='Enemy rope cut — steal its light!';const victim=game.sunStateFor(enemy),own=game.sunStateFor(p),light=Math.min(10,victim.radiance);victim.radiance-=light;own.radiance=Math.min(100,own.radiance+light);this.state.cuts=(this.state.cuts||0)+1;}
   }
  }
 }
 before(game,dt){
  if(this.kind==='sun-race'){
   const teams=TEAMS.map(team=>[...game.players.values()].filter(p=>p.team===team&&p.connected!==false));
   this.state.soloAvailable=this.state.phase==='waiting'&&game.time>=5&&teams.flat().filter(p=>!p.bot).length===1;
   if(this.state.phase==='waiting'&&teams.every(t=>t.length===game.teamSize)){this.state.phase='racing';this.state.startedAt=game.time;}
   if(this.state.phase==='waiting')for(const p of game.players.values()){p.input={x:0,z:0};p.commands=[];}
   if(this.state.phase==='racing'){this.state.remaining=Math.max(0,480-(game.time-this.state.startedAt));for(const p of game.players.values())p.racePull=(p.haulUntil>game.time?1.6:1)*(p.raceRival?.82:1);}
  }
  if(this.kind!=='last-light')return;
  if(this.state.phase==='intermission'&&game.time>=this.state.nextAt){
   this.state.wave++;this.state.waveStartedAt=game.time;this.state.boss=null;this.state.phase='wave';const wave=this.state.wave,shades=game.systems.find(s=>s.spawn),count=Math.min(40,Math.max(2,Math.ceil((4+wave*2)*game.rules.shadeCount*(.7+.3*game.keeperCount()))));
   for(let i=0;i<count;i++){const hounds=Math.min(Math.floor(count/3)*3,Math.max(3,Math.floor(count/6)*3)),a=(i<hounds?Math.floor(i/3)*3/count*Math.PI*2+i%3*.06:i/count*Math.PI*2)+wave*.4,type=i<hounds?'hound':(game.difficulty==='eclipse'||wave>3)&&i%5===0?'brute':i%3===0?'lurker':'wisp';const s=shades.spawn(game,type,Math.cos(a)*37,Math.sin(a)*37,'hearth-zone');s.wave=wave;}
   if(wave===3){const boss=shades.spawn(game,'brute',0,-33,'hearth-zone');boss.boss=true;boss.name='Harbour Brute';boss.hp=boss.maxHP=160*(game.difficulty==='gentle'?.75:game.difficulty==='eclipse'?1.2:1)*(.7+.3*game.keeperCount());boss.wave=wave;boss.attackAt=game.time+5;this.state.boss=boss.id;}
  }
  for(const t of this.state.towers)if(t.lit){t.fuel=Math.max(0,t.fuel-dt*.6);if(!t.fuel)t.lit=false;else for(const s of game.shades)if(distance(t,s)<12)s.hp-=dt*(s.boss?12:24);}
  for(const w of this.state.walls){if(w.hp>0&&this.state.phase==='wave')for(const s of game.shades)if(distance(w,s)<3)w.hp=Math.max(0,w.hp-dt*(s.boss?18:5));w.collider.setEnabled(w.hp>0);}
  for(const s of game.shades)if(s.boss){if(game.time>=s.attackAt){s.attackAt=game.time+7;s.warningUntil=game.time+1.5;s.attackTarget={...game.sunPositionFor()};}if(s.warningUntil&&game.time>=s.warningUntil){s.warningUntil=0;const sun=game.sunPositionFor();if(distance(sun,s.attackTarget)<5)game.sun.radiance=Math.max(0,game.sun.radiance-18*game.rules.sunDamage*(game.difficulty==='gentle'?0:1));for(const p of game.players.values())if(distance(p,s.attackTarget)<5&&!(p.dodgeUntil>game.time))p.hp-=28;}}
 }
 after(game,dt){
  if(this.kind==='last-light'){
   if(game.failed)this.state.phase='finished';
   if(this.state.phase==='wave'&&!game.shades.length){this.state.phase='intermission';this.state.score+=this.state.wave*100;this.state.nextAt=game.time+18;if(this.state.wave>=3){this.state.phase='finished';this.state.winner='keepers';this.state.finishedAt=game.time;}game.sun.radiance=Math.min(100,game.sun.radiance+20);game.teamwork(30);}
   if(this.state.phase==='wave'){game.sun.radiance=Math.max(0,game.sun.radiance-dt*(game.difficulty==='gentle'?0:.45)*game.rules.sunDamage);if(game.sun.radiance===0&&game.difficulty!=='gentle'){game.failed=true;this.state.phase='finished';}}
   this.state.alive=game.shades.length;this.state.nextIn=Math.max(0,this.state.nextAt-game.time);this.state.score+=(game.systems.find(s=>s.deaths)?.deaths||[]).filter(d=>d.at===game.time).length*10;
  }
  if(this.kind==='sun-race'&&this.state.phase==='racing'){
   for(const team of TEAMS){const sun=game.sunPositionFor({team}),start=game.recipe.race.starts[team],engine=game.recipe.race.engines[team],route=Math.hypot(engine[0]-start[0],engine[1]-start[1]);this.state.progress[team]=Math.max(0,Math.min(1,1-distance(sun,{x:engine[0],z:engine[1]})/route));
    if(distance(sun,{x:engine[0],z:engine[1]})<2.6){this.state.winner=team;this.state.phase='finished';this.state.finishedAt=game.time;}
   }
   if(!this.state.remaining&&this.state.phase!=='finished'){const difference=this.state.progress.dawn-this.state.progress.dusk;this.state.winner=Math.abs(difference)<.005?'draw':difference>0?'dawn':'dusk';this.state.phase='finished';this.state.finishedAt=game.time;}
  }
 }
 snapshot(game){return {mode:{...this.state,walls:this.state.walls.map(({collider,...w})=>w)},...(this.kind==='sun-race'?{suns:TEAMS.map(team=>({...game.sunPositionFor({team}),...game.sunStates[team],team}))}:{})};}
}

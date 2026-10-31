import { inPolygon,clamp } from '../../shared/map-math.js';
import { distance } from '../../shared/rope-routing.js';
// The Sun's fire burns Keepers who crowd it: full heat at its skin, none beyond HEAT_OUTER (rope haulers stay outside).
const HEAT_OUTER=2.5,HEAT_INNER=1.6;
export class SunSystems {
 constructor(){this.state={radiance:100,radius:18,mood:'curious',pulseUntil:0,gutterFor:0};}
 before(game,dt){
  for(const p of game.players.values()){
   if(p.connected===false||p.downedUntil>0||!(p.hp>0))continue;
   const sun=game.sunPositionFor(p),d=distance(p,sun),inside=d<HEAT_OUTER&&game.rules.sunHeat;
   // Heat builds over about half a second: brushing past costs little, standing in the fire burns hard.
   p.sunHeat=clamp((p.sunHeat||0)+dt*(inside?2:-3),0,1);
   if(!inside)continue;
   const k=clamp((HEAT_OUTER-d)/(HEAT_OUTER-HEAT_INNER),0,1);p.burnUntil=game.time+.3;p.burn=Math.round(k*100)/100;
   if(p.shieldUntil>game.time||p.dodgeUntil>game.time||p.abilityEvadeUntil>game.time)continue;
   p.hp=Math.max(0,p.hp-dt*22*k*p.sunHeat*(p.hero==='brann'?.5:1)*game.rules.sunHeat);
   // Burning hurts but never staggers: the hurt reaction compares against health after the burn.
   if(game.health.has(p.id))game.health.set(p.id,p.hp);
  }
 }
 command(game,p,cmd) {
  const sun=game.sunPositionFor(p),state=game.sunStateFor(p);
  if(cmd==='pulse'&&state.radiance>=15&&game.time>state.pulseUntil+2){
   const crew=[...game.players.values()].filter(ally=>(!p.team||ally.team===p.team)&&ally.rope.attached&&!ally.rope.tied&&ally.rope.tension>.12);
   if(crew.length>=Math.min(3,game.keeperCount(p.team))){state.radiance-=15;state.pulseUntil=game.time+1;game.teamwork?.(12);for(const shade of game.shades||[])if(distance(shade,sun)<24){shade.stunUntil=game.time+3;shade.hp-=shade.type==='brute'?8:20;}}
  }
  if(cmd==='use'&&!game.machines){const cradle=game.recipe.entities.find(e=>e.type==='cradle'&&distance(sun,{x:e.p[0],z:e.p[1]})<2.6&&distance(p,{x:e.p[0],z:e.p[1]})<4);if(cradle)this.restore(game,cradle);}
 }
 restore(game,cradle) {
  game.restored??=[];if(game.restored.some(z=>z.id===cradle.restores))return;
  const zone=game.recipe.zones.find(z=>z.id===cradle.restores);game.restored.push({id:cradle.restores,x:cradle.p[0],z:cradle.p[1],radius:zone?.radius||55,at:game.time});
  if(cradle.id===game.recipe.mission?.finale)game.finishRadiance=this.state.radiance;
  this.state.radiance=100;this.state.heat=0;game.checkpoint={x:cradle.p[0],z:cradle.p[1]};game.physics.sunBody.setLinvel({x:0,y:0},true);
 }
 after(game,dt) {
  if(game.recipe.mode==='sun-race'){for(const state of Object.values(game.sunStates)){state.radiance=clamp(state.radiance+dt*.3,0,100);state.radius=(state.pulseUntil>game.time?26:5+state.radiance*.13)*game.rules.lightScale;}return;}
  game.sun=this.state;const s=game.physics.snapshot().sun,state=this.state;
  const restored=(game.restored||[]).some(z=>{const zone=game.recipe.zones.find(a=>a.id===z.id);return zone?.poly?inPolygon(s.x,s.z,zone.poly):distance(s,z)<z.radius;});
  const well=game.recipe.entities.filter(e=>e.type==='well').filter((e,i)=>!['veteran','eclipse'].includes(game.difficulty)||i%2===0).some(e=>e.type==='well'&&distance(s,{x:e.p[0],z:e.p[1]})<(e.radius||3.5));
  const sanctuary=(game.effects||[]).some(e=>['bastion','grove'].includes(e.kind)&&distance(s,e)<e.radius&&e.until>game.time);
  // A charging hearth holds the Sun steady: only the Shades gnawing it can dim it there.
  const hearth=game.recipe.entities.some(e=>e.type==='cradle'&&game.machines?.[e.id]?.active&&!game.machines[e.id].complete&&distance(s,{x:e.p[0],z:e.p[1]})<2.6);
  const drain=game.rules.drain*(game.mutators.includes('endless-night')?1.25:1);
  state.radiance=clamp(state.radiance+dt*(well?12:restored&&!game.mutators.includes('endless-night')?3:sanctuary?1:hearth?0:-drain),0,100);
  state.gutterFor=state.radiance===0?state.gutterFor+dt:0;
  if(state.gutterFor>(game.difficulty==='eclipse'?10:25)){game.failed=true;game.failureReason='The Sun was extinguished for ten seconds.';}
  state.dim=(game.shades||[]).filter(a=>a.type==='moth'&&a.hp>0&&distance(a,s)<3).length;
  state.radius=state.pulseUntil>game.time?26:Math.max(5,5+state.radiance*.13-state.dim*2.5)*game.rules.lightScale;
  if(game.world?.blizzard)state.radius*=.6;
  const tension=Math.max(0,...[...game.players.values()].map(p=>p.rope.tension||0));
  state.mood=state.radiance<20?'scared':well||restored?'joyful':tension>.8?'strained':state.radiance<45?'sleepy':'curious';
 }
 snapshot(game){return {sun:{...game.physics.snapshot().sun,...this.state},restored:game.restored||[],failed:!!game.failed};}
}

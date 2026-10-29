import { DrownedKing } from './drowned-king.js';
import { distance } from '../../shared/rope-routing.js';
import { segmentDistance } from '../../shared/map-math.js';
export class Bosses {
 constructor(game){if(game.recipe.boss?.kind==='drownedKing')return new DrownedKing(game);this.spec=game.recipe.boss;this.state=this.spec?{id:this.spec.id,name:this.spec.name,kind:this.spec.kind,x:this.spec.p[0],z:this.spec.p[1],active:false,defeated:false,phase:0,progress:0,limbs:[0,0,0],nextAttack:0}:null;game.boss=this.state;}
 ready(game){return (this.spec.requires||[]).every(id=>game.machines[id]?.complete||game.flags[id]);}
 illuminated(game,id){return !!game.machines[id]?.lit;}
 strike(game,p){const s=this.state,sun=game.physics.snapshot().sun;if(this.spec?.kind!=='frostLeviathan'||!s?.active||s.defeated||!s.exposed||distance(p,s)>6||game.sun.radiance<=0||distance(sun,s)>game.sun.radius)return;if(game.time<(p.bossStrikeAt||0))return;p.bossStrikeAt=game.time+.6;s.phaseDamage=Math.min(1,(s.phaseDamage||0)+.12);}
 command(game,p,cmd){if(p.castReleasedAt===game.time&&(cmd==='ability-E'&&p.hero==='brann'||cmd==='ability-Q'&&p.hero==='elian'))this.strike(game,p);}
 after(game,dt){const s=this.state,e=this.spec;if(!s||s.defeated)return;s.active=this.ready(game);if(!s.active)return;
  const sun=game.physics.snapshot().sun,inLens=distance(sun,{x:e.lens[0],z:e.lens[1]})<(e.lensRadius||3.2);
  if(e.kind==='tidewraith'){
   s.hint='Keep the Sun in the lighthouse lens. Aim all three mirrors at the kraken; light burns the grabbing tentacles.';
   for(let i=0;i<e.mirrors.length;i++){const beam=game.beams.find(b=>b.source===e.mirrors[i]&&segmentDistance(s.x,s.z,[b.a.x,b.a.z],[b.b.x,b.b.z])<2.5);s.limbs[i]=Math.max(0,Math.min(1,s.limbs[i]+dt*(inLens&&beam?1/(e.hold||12):-.025)));}
   s.progress=s.limbs.reduce((a,b)=>a+b,0)/3;s.exposed=inLens&&s.limbs.every(v=>v>=1);if(s.exposed)this.defeat(game);
  }
  if(e.kind==='thornMother'){
   const grown=e.vines.filter(id=>game.machines[id]?.complete).length;s.phase=grown===e.vines.length?1:0;s.exposed=!!s.phase;
   s.hint=s.exposed?'The counter-vines opened her heart. Haul the Sun into it and hold the light.':'Grow all three counter-vines in the Sun’s light to untangle the roots.';
   if(!s.exposed){s.progress=grown/e.vines.length*.65;if(game.time>=(s.rootAt||0)){s.rootAt=game.time+8;for(const p of game.players.values())if(p.rope.attached)p.rope.grabUntil=game.time+5;}}
   else{for(const p of game.players.values())p.rope.grabUntil=0;if(distance(sun,s)<(e.heartRadius||3))s.progress=Math.min(1,s.progress+dt/(e.hold||10));if(s.progress>=1)this.defeat(game);}
  }
  if(e.kind==='frostLeviathan'){
   const hole=game.recipe.entities.find(a=>a.id===e.holes[s.phase]);s.exposed=!!hole&&!!game.machines[hole.id]?.open;
   s.hint=s.exposed?'It surfaced! Strike from the ice rim while the Sun lights its body.':'Melt the next marked hole with the Sun. Keep the Sun on solid ice beside the ring.';
   if(s.exposed){s.x=hole.p[0];s.z=hole.p[1];for(const b of game.beams)if(segmentDistance(s.x,s.z,[b.a.x,b.a.z],[b.b.x,b.b.z])<2)s.phaseDamage=Math.min(1,(s.phaseDamage||0)+dt*.12);
    if((s.phaseDamage||0)>=1){s.phase++;game.flags[e.id+'-phase-'+s.phase]=true;s.phaseDamage=0;s.exposed=false;game.teamwork(20);if(s.phase>=e.holes.length)this.defeat(game);}
   }else{const angle=game.time*.2;s.x=e.p[0]+Math.cos(angle)*14;s.z=e.p[1]+Math.sin(angle)*10;}
   if(!s.defeated)s.progress=(s.phase+(s.phaseDamage||0))/e.holes.length;
  }
  if(e.kind==='magmaColossus'){
   const channel=game.machines[e.channels[s.phase]];s.exposed=!!channel?.complete;
   s.hint=s.exposed?'The cooled armor has cracked. Put the Sun in the core-light ring and expose the heart.':'Open this phase’s coolant valve. Water must cool the armor before sunlight can reach the core.';
   if(s.exposed&&inLens&&game.sun.radiance>15&&distance(sun,s)<game.sun.radius)s.phaseDamage=Math.min(1,(s.phaseDamage||0)+dt/(e.hold||10));
   if((s.phaseDamage||0)>=1){s.phase++;game.flags[e.id+'-phase-'+s.phase]=true;s.phaseDamage=0;s.exposed=false;game.teamwork(20);if(s.phase>=e.channels.length)this.defeat(game);}
   if(!s.defeated)s.progress=(s.phase+(s.exposed?.5+(s.phaseDamage||0)*.5:(channel?.progress||0)*.5))/e.channels.length;
  }
  if(e.kind==='eclipseHerald'){
   s.relays=e.receivers.map(id=>this.illuminated(game,id));const lit=s.relays.filter(Boolean).length;s.exposed=inLens&&lit===4;
   s.hint=`${lit}/4 relays lit. Keep the Sun at the dawn prism and aim every relay. The Herald eats unshared light.`;
   game.sun.radiance=Math.max(0,game.sun.radiance-dt*(s.exposed?.1:.9)*game.rules.sunDamage*(game.difficulty==='gentle'?0:1));s.progress=Math.max(0,Math.min(1,s.progress+dt*(s.exposed?1/(e.hold||18):-.035)));
   if(s.progress>=1)this.defeat(game);
  }
  if(!s.defeated)this.attack(game,dt);
 }
 attack(game,dt){const s=this.state,e=this.spec,sun=game.physics.snapshot().sun;if(s.attack&&game.time>=s.attack.at&&!s.attack.hit){s.attack.hit=true;const a=s.attack;
   for(const p of game.players.values())if(distance(p,a)<a.radius||p.rope.attached&&segmentDistance(a.x,a.z,[sun.x,sun.z],[p.x,p.z])<a.radius){if(p.dodgeUntil>game.time||p.shieldUntil>game.time)continue;p.hp=Math.max(0,p.hp-8);if(p.rope.attached){p.rope.grabUntil=game.time+3;p.rope.fray=Math.min(.9,(p.rope.fray||0)+.13);}}
  }
  if(game.time>=s.nextAttack){s.nextAttack=game.time+(e.attackInterval||10);const crew=[...game.players.values()].filter(p=>p.connected!==false),p=crew[Math.floor(game.time/10)%Math.max(1,crew.length)];s.attack={x:p?.x??sun.x,z:p?.z??sun.z,radius:3.2,at:game.time+2.3,until:game.time+4,kind:e.kind};}
  for(const p of game.players.values())if(p.rope.grabUntil>game.time&&(game.sun.pulseUntil>game.time||game.beams.some(b=>segmentDistance(p.x,p.z,[b.a.x,b.a.z],[b.b.x,b.b.z])<3)))p.rope.grabUntil=0;
 }
 defeat(game){const s=this.state;s.defeated=true;s.progress=1;s.defeatedAt=game.time;s.attack=null;game.flags[s.id]=true;game.sun.radiance=100;game.sun.heat=0;for(const p of game.players.values())p.rope.grabUntil=0;game.teamwork(100);}
 snapshot(){return {boss:this.state};}
}

import { distance } from '../../shared/rope-routing.js';

export const PUZZLE_TYPES = ['dial','runes','sequence','cargoSocket','cargo','secret','mural'];
const at = e => ({x:e.p[0],z:e.p[1]});
export class Puzzles {
 constructor(game){this.entities=game.recipe.entities.filter(e=>PUZZLE_TYPES.includes(e.type));game.puzzles=this;game.clues={};
  for(const e of this.entities){const s=game.machines[e.id];s.values=Array(e.code?.length||0).fill(0);s.notes=[];s.discovered=false;}
 }
 ready(game,e){return (e.requires||[]).every(id=>game.machines[id]?.complete||game.flags[id]);}
 award(game,e){const s=game.machines[e.id];if(s.complete)return;s.complete=true;s.progress=1;game.flags[e.id]=true;
  if(game.recipe.mission?.secrets?.includes(e.id)){game.shards=(game.shards||0)+1;game.teamwork(20);}else game.teamwork(8);
 }
 command(game,p,cmd){
  if(cmd==='tow'){
   if(p.cargoTow){p.cargoTow=null;return;}
   const point=r=>({x:r.body.translation().x,z:r.body.translation().y});
   const cargo=[...game.physics.props].filter(([,r])=>!r.carriedBy&&distance(p,point(r))<2.8).sort((a,b)=>distance(p,point(a[1]))-distance(p,point(b[1])))[0];
   if(cargo){p.cargoTow=cargo[0];p.rope.attached=false;p.hint='Tow the cargo to its gold tray. T releases it.';}return;
  }
  if(!cmd.startsWith('puzzle:'))return;
  const [,id,slot,value]=cmd.split(':'),e=this.entities.find(e=>e.id===id),s=game.machines[id];
  if(!e||!s||distance(p,at(e))>3.2||!this.ready(game,e)||p.downedUntil>game.time||!game.physics.lineOfSight(p,at(e)))return;
  if(['dial','runes'].includes(e.type)){
   if(slot==='submit'){
    if(e.clues?.some(id=>!game.clues[id])){p.hint='Find the inscriptions first. AI Keepers share clues when they scout.';return;}
    if(s.values.every((v,i)=>v===e.code[i]))this.award(game,e);else{p.hint='The pattern does not match the mural.';s.mistakeAt=game.time;}
   }else if(/^\d+$/.test(slot)&&/^\d+$/.test(value)&&+slot<s.values.length&&+value<(e.symbols?.length||4))s.values[+slot]=+value;
  }
 }
 activate(game,p,e){
  const s=game.machines[e.id];if(!this.ready(game,e)){p.hint=e.hint||'Finish the preceding puzzle first.';return;}
  if(e.type==='sequence'){s.demoAt=game.time;p.hint='Listen and watch: '+e.order.join(' → ');return;}
  if(e.sequence){const group=this.entities.find(g=>g.id===e.sequence);if(!group)return;const state=game.machines[group.id];if(state.complete)return;
   state.playedAt=game.time;state.played=e.note;state.notes.push(e.note);
   if(e.note!==group.order[state.notes.length-1]){state.notes=[];state.mistakeAt=game.time;p.hint='Listen again; the choir returns to its first note.';}
   state.progress=state.notes.length/group.order.length;if(state.notes.length===group.order.length)this.award(game,group);return;
  }
  if(e.type==='cargo'){const r=game.physics.props.get(e.prop);if(r&&distance(p,{x:r.body.translation().x,z:r.body.translation().y})<3){p.cargoTow=p.cargoTow===e.prop?null:e.prop;p.rope.attached=false;}return;}
  if(e.type==='mural'){game.clues[e.id]=true;s.discovered=true;s.demoAt=game.time;p.hint=e.hint;return;}
  if(e.type==='secret'){
   if(e.breakable&&!game.destroyed.includes(e.breakable)&&!game.machines[e.fallback]?.complete){p.hint='Break the marked obstruction with Brann, or use its hand winch.';return;}
   if(e.ability&&!game.effects.some(a=>a.kind===e.ability&&a.until>game.time&&distance(a,s)<(e.radius||6))&&!game.machines[e.fallback]?.complete&&!game.flags[e.fallback]){p.hint=e.hint;return;}
   this.award(game,e);
  }
 }
 forces(game,dt){for(const p of game.players.values())if(p.cargoTow){const r=game.physics.props.get(p.cargoTow);if(!r||r.carriedBy||p.downedUntil>game.time||p.connected===false){p.cargoTow=null;continue;}
   const t=r.body.translation(),dx=p.x-t.x,dz=p.z-t.y,d=Math.hypot(dx,dz);if(d>12){p.cargoTow=null;continue;}if(d>1.5)r.body.applyImpulse({x:dx/d*Math.min(38,(d-1.5)*14)*dt,y:dz/d*Math.min(38,(d-1.5)*14)*dt},true);
  }}
 after(game,dt){const props=game.physics.snapshot().props;
  for(const e of this.entities){const s=game.machines[e.id];
   if(e.type==='mural'&&[...game.players.values()].some(p=>distance(p,s)<(e.radius||4))){if(!s.discovered&&e.autoPlay)s.demoAt=game.time;game.clues[e.id]=true;s.discovered=true;}
   if(e.type==='cargoSocket'&&!s.complete){const required=e.props||[];s.loaded=props.filter(p=>!p.carriedBy&&distance(p,s)<(e.radius||3)&&(!required.length||required.includes(p.id))).map(p=>p.id);s.progress=Math.min(1,s.loaded.length/(e.count||required.length||1));if(s.progress>=1){s.hold=(s.hold||0)+dt;if(s.hold>1.5)this.award(game,e);}else s.hold=0;}
   if(e.type==='secret'&&e.auto&&this.ready(game,e)){s.hold=[...game.players.values()].some(p=>distance(p,s)<(e.radius||2))?(s.hold||0)+dt:0;if(s.hold>2)this.award(game,e);}
  }
 }
 snapshot(game){return {clues:game.clues};}
}

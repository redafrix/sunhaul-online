import { Navigation } from './navigation.js';
import { distance } from '../../shared/rope-routing.js';
import { HERO_IDS,HEROES,ABILITIES } from '../../shared/abilities.js';
import { missionObjective } from '../../shared/mission-flow.js';
export class Bots {
 constructor(game){this.navigation=new Navigation(game.recipe,game.catalog);this.paths=new Map();this.seq=0;game.setBots=heroes=>this.configure(game,heroes);game.ping=point=>this.ping(game,point);}
 configure(game,heroes){
  if(game.recipe.mode==='sun-race')return;
  const humans=[...game.players.values()].filter(p=>!p.bot);
  const occupied=new Set(humans.map(p=>p.hero));
  const requested=Number.isInteger(heroes)?Math.max(0,Math.min(2,heroes)):Array.isArray(heroes)?Math.min(2,heroes.length):0;
  const wanted=HERO_IDS.filter(id=>!occupied.has(id)).slice(0,Math.min(requested,Math.max(0,3-humans.length)));
  const bots=[...game.players.values()].filter(p=>p.bot);
  if(bots.length===wanted.length&&bots.every((p,i)=>p.hero===wanted[i]))return;
  for(const p of bots)game.removePlayer(p.id);
  this.paths.clear();
  wanted.forEach((hero,i)=>game.addPlayer(`bot-${i}`,{hero,name:HEROES[hero].split(' · ')[0]+' (AI)',bot:true}));
 }
 ping(game,point){
  if(!Number.isFinite(point?.x)||!Number.isFinite(point?.z)||Math.abs(point.x)>game.recipe.size[0]/2||Math.abs(point.z)>game.recipe.size[1]/2)return;
  const entities=game.recipe.entities.filter(e=>e.id&&e.type!=='well'&&distance({x:e.p[0],z:e.p[1]},point)<3).sort((a,b)=>distance({x:a.p[0],z:a.p[1]},point)-distance({x:b.p[0],z:b.p[1]},point)),entity=entities[0],bots=[...game.players.values()].filter(p=>p.bot&&!(p.downedUntil>game.time));
  if(point.kind==='haul'){for(const p of bots){p.task=p.delivery=null;p.cargoTow=null;}game.lastPing={...point,at:game.time};return;}
  const guide=missionObjective(game.recipe,{machines:game.machines,flags:game.flags,mission:game.mission,sun:game.sunPositionFor()},null);
  const bot=bots.sort((a,b)=>(a.hero==='ivo'&&['capstan','crank','mirror','valve'].includes(entity?.type)?-10:0)+distance(a,point)-((b.hero==='ivo'&&['capstan','crank','mirror','valve'].includes(entity?.type)?-10:0)+distance(b,point)))[0];
  if(bot){bot.delivery=null;bot.cargoTow=null;bot.task={x:entity?.p[0]??point.x,z:entity?.p[1]??point.z,id:entity?.id,type:entity?.type||'move',aim:entity?.target||(guide?.entity?.id===entity?.id&&guide.action==='mirror'?guide.objective.done?.split('.')[0]||guide.objective.id:null),until:game.time+60};if(entity?.type==='cargoSocket'){const c=game.physics.snapshot().props.find(c=>(!entity.props?.length||entity.props.includes(c.id))&&distance(c,point)>(entity.radius||3)*.8&&!bots.some(b=>b.delivery?.prop===c.id));if(c){bot.delivery={prop:c.id,point:{x:entity.p[0],z:entity.p[1]}};bot.task=null;}}}game.lastPing={...point,at:game.time,bot:bot?.id};
 }
 support(game,leader,bots,sun){
  const guide=missionObjective(game.recipe,{machines:game.machines,flags:game.flags,mission:game.mission,sun,boss:game.boss},leader);
  for(const p of bots)if(p.task?.until<=game.time||p.task?.auto&&(p.task.id!==guide?.entity?.id||!['operate','mirror'].includes(guide?.action)))p.task=null;
  const e=guide?.entity;if(!e||!['operate','mirror'].includes(guide.action)||distance(leader,{x:e.p[0],z:e.p[1]})>18||bots.some(p=>p.task?.id===e.id)||!['capstan','crank','lever','valve','sluiceGate','gate','drawbridge','winch','mirror','prismSocket'].includes(e.type))return;
  const bot=bots.filter(p=>!p.task&&!p.delivery&&!(p.downedUntil>game.time)).sort((a,b)=>(a.hero==='ivo'?-12:0)+distance(a,{x:e.p[0],z:e.p[1]})-((b.hero==='ivo'?-12:0)+distance(b,{x:e.p[0],z:e.p[1]})))[0];
  if(bot)bot.task={id:e.id,type:e.type,x:e.p[0],z:e.p[1],aim:e.target||(guide.action==='mirror'?guide.objective.done?.split('.')[0]||guide.objective.id:null),auto:true,until:game.time+60};
 }
 before(game){
  this.navigation.update(game);
  const leader=[...game.players.values()].find(p=>!p.bot&&p.connected!==false);if(!leader)return;
  if(game.recipe.mode==='sun-race'){this.race(game);return;}
  const sun=game.physics.snapshot().sun,bots=[...game.players.values()].filter(p=>p.bot);this.support(game,leader,bots,sun);
  const downed=[...game.players.values()].find(a=>a.downedUntil>game.time&&!a.bot&&a.connected!==false),rescuer=downed&&bots.filter(p=>!(p.downedUntil>game.time)).sort((a,b)=>distance(a,downed)-distance(b,downed))[0];
  bots.forEach((p,i)=>{
   if(p.downedUntil>game.time){p.botRole='Recovering';game.input(p.id,{seq:Math.max(++this.seq,p.ack+1),x:0,z:0,commands:[]});return;}
   const puzzle=game.recipe.entities.find(e=>e.ropeRoute&&!game.machines[e.id]?.complete&&distance(leader,{x:e.p[0],z:e.p[1]})<12);
   const commands=[],task=p.task?.until>game.time?p.task:null,shade=game.shades?.slice().filter(s=>s.hp>0).sort((a,b)=>distance(p,a)-distance(p,b))[0];
   if(!task&&!p.delivery){
    const tray=game.recipe.entities.find(e=>!e.optional&&((e.type==='cargoSocket'&&!game.machines[e.id]?.complete)||(e.type==='counterweightLift'&&e.tray&&!game.machines[e.id]?.complete))&&(e.requires||[]).every(id=>game.machines[id]?.complete||game.flags[id])&&distance(leader,{x:e.p[0],z:e.p[1]})<32);
    if(tray){const point=tray.tray?{x:tray.tray[0],z:tray.tray[1]}:{x:tray.p[0],z:tray.p[1]},required=tray.props||tray.cargo||[];
     const cargo=game.physics.snapshot().props.find(c=>(!required.length||required.includes(c.id))&&!c.carriedBy&&distance(c,point)>(tray.radius||3)*.8&&!bots.some(b=>b.delivery?.prop===c.id));
     if(cargo)p.delivery={prop:cargo.id,point};
    }
   }
   let target={x:sun.x+(i-1)*1.5,z:sun.z+2.3};
   const load=game.recipe.entities.find(e=>e.type==='loadField'&&!game.machines[e.id]?.complete&&(e.requires||[]).every(id=>game.machines[id]?.complete||game.flags[id])&&distance(sun,{x:e.p[0],z:e.p[1]})<(e.radius||14)+12),plate=load&&game.recipe.entities.find(e=>e.id===load.supports[i%load.supports.length]);
   p.botRole='Guarding the Sun';
   if(p===rescuer){target=downed;p.botRole='Reviving you';if(p.rope.attached)commands.push('rope');p.cargoTow=null;if(distance(p,downed)<2.4)commands.push('use');}
   else if(plate){target={x:plate.p[0],z:plate.p[1]};p.botRole='Holding a support';if(p.rope.attached)commands.push('rope');p.cargoTow=null;}
   else if(task){target=task;if(p.rope.attached)commands.push('rope');if(distance(p,task)<2.5&&task.type!=='plate'&&game.time>=(p.botUseReady||0)){
    const e=game.recipe.entities.find(e=>e.id===task.id),aimId=task.aim||e?.target,aim=aimId&&game.recipe.entities.find(a=>a.id===aimId),machine=game.machines[task.id];
    if(['mirror','prismSocket'].includes(task.type)&&aim){const wanted=Math.atan2(aim.p[1]-e.p[1],aim.p[0]-e.p[0]),angle=machine.angle,diff=Math.atan2(Math.sin(wanted-angle),Math.cos(wanted-angle));if(game.machines[aim.id]?.complete||!task.auto&&Math.abs(diff)<Math.PI/12)p.task=null;else if(Math.abs(diff)>=Math.PI/12)commands.push(diff<0?'turn-back':'interact');}
    else if(task.type==='move'||machine?.complete&&task.type!=='plate')p.task=null;
    else if(!machine?.active||['capstan','crank','cradle','mural','sequence','secret','cargo'].includes(task.type))commands.push('interact');
    p.botUseReady=game.time+.6;
   }p.botRole=task.type==='plate'?'Holding a plate':`Helping at ${game.recipe.entities.find(e=>e.id===task.id)?.label||task.type}`;}
   else if(p.delivery){p.botRole='Delivering cargo';const cargo=game.physics.snapshot().props.find(c=>c.id===p.delivery.prop);if(!cargo){p.delivery=null;p.cargoTow=null;}else if(distance(cargo,p.delivery.point)<2){p.delivery=null;p.cargoTow=null;}else if(p.cargoTow===cargo.id)target=p.delivery.point;else{target=cargo;if(distance(p,cargo)<2.6){p.cargoTow=cargo.id;p.rope.attached=false;}}if(p.rope.attached)commands.push('rope');}
   else if(game.boss?.active&&game.boss.exposed&&!game.boss.defeated&&['frostLeviathan','drownedKing'].includes(game.boss.kind)){target={x:game.boss.x+(i-1)*2,z:game.boss.z+4.5};if(p.rope.attached)commands.push('rope');if(distance(p,game.boss)<6)commands.push('attack');}
   else if(leader.rope.attached&&!leader.rope.tied){p.botRole=p.rope.attached?'Hauling with you':'Taking a rope';if(p.rope.attached&&(Math.hypot(leader.input.x,leader.input.z)>.1||distance(leader,sun)>5))target={x:leader.x,z:leader.z};}
   else if(shade&&distance(shade,sun)<7&&!p.rope.attached)target=shade;
   if(puzzle&&p!==rescuer&&!plate&&!task&&!p.delivery){target={x:sun.x+(i-1)*1.8,z:sun.z+3.5};p.botRole='Keeping the rope route clear';if(p.rope.attached)commands.push('rope');}
   if(!puzzle&&!task&&!plate&&!p.delivery&&p!==rescuer&&!(game.boss?.active&&game.boss.exposed&&['frostLeviathan','drownedKing'].includes(game.boss.kind))){if(leader.rope.attached&&!leader.rope.tied&&!p.rope.attached&&distance(p,sun)<3.5)commands.push('rope');else if(!leader.rope.attached&&p.rope.attached)commands.push('rope');}
   if(!puzzle&&p.rope.attached&&p.rope.nodes?.length){commands.push('rope');const d=distance(leader,sun)||1;target={x:sun.x+(leader.x-sun.x)/d*2.3,z:sun.z+(leader.z-sun.z)/d*2.3};}
   if(p.rope.tangle||p.rope.fray>.8){if(p.rope.attached)commands.push('rope');target={x:sun.x+(i-1),z:sun.z+2};}
   if(shade&&distance(p,shade)<2.8){commands.push('attack');if(['cone','area'].includes(ABILITIES[p.hero].Q.type)&&(distance(p,sun)>(ABILITIES[p.hero].Q.range||0)||(sun.x-p.x)*p.facing.x+(sun.z-p.z)*p.facing.z<0)&&!(p.cooldowns?.Q>game.time))commands.push('ability-Q');if(p.ultimate>=100)commands.push('ability-R');}
   let route=this.paths.get(p.id);if(!route||game.time>route.at+.7||distance(route.target,target)>3){route={target:{x:target.x,z:target.z},path:this.navigation.route(p,target),at:game.time};this.paths.set(p.id,route);}
   while(route.path.length>1&&distance(p,route.path[0])<.9)route.path.shift();const next=route.path[0]||target,dx=next.x-p.x,dz=next.z-p.z,d=Math.hypot(dx,dz);
   const progress=p.botProgress;
   if(!progress||distance(p,progress)>.4)p.botProgress={x:p.x,z:p.z,at:game.time};
   else if(game.time-progress.at>4&&distance(p,target)>2){
    const safe=game.safeSpawn(sun);
    p.rope={attached:false,tension:0};
    p.body.setTranslation({x:safe.x,y:safe.z},true);
    p.body.setNextKinematicTranslation({x:safe.x,y:safe.z});
    game.physics.sync(p);
    p.botProgress={x:p.x,z:p.z,at:game.time};
    this.paths.delete(p.id);
   }
   const close=distance(p,target)<(plate||task?.type==='plate'?.45:task?1.5:.65),input={seq:Math.max(++this.seq,p.ack+1),x:close||d<.2?0:dx/d,z:close||d<.2?0:dz/d,sprint:!p.rope.attached&&distance(p,target)>7,commands:[...new Set(commands)]};game.input(p.id,input);
  });
 }
 race(game){
  for(const p of game.players.values())if(p.raceRival){
   const sun=game.sunPositionFor(p),engine=game.recipe.race.engines[p.team];
   const sign=Math.sign(engine[0]-sun.x)||1;
   const target=p.rope.attached?{x:engine[0]+sign*4,z:Math.abs(engine[0]-sun.x)>12?4:0}:sun;
   const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz)||1;
   const commands=!p.rope.attached&&distance(p,sun)<3.4?['rope']:[];
   p.botRole='Racing your crew';
   game.input(p.id,{seq:Math.max(++this.seq,p.ack+1),x:dx/d*.82,z:dz/d*.82,commands});
  }
 }
 snapshot(game){return {ping:game.lastPing||null};}
}

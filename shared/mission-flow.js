import { objectiveDone } from './machines.js';

const at = e => ({id:e.id,type:e.type,x:e.p[0],z:e.p[1],label:e.label||e.type});
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);

// Recipe order and prerequisites drive player guidance and the AI's support roles.
export function missionObjective(recipe,state,player) {
 if(recipe.mode||state.mission?.complete)return null;
 const objectives=(recipe.objectives||[]).filter(o=>!o.optional),machines=state.machines||{},flags=state.flags||{};
 const index=objectives.findIndex(o=>!objectiveDone(o,machines,flags));if(index<0)return null;
 const objective=objectives[index],id=objective.done?.split('.')[0]||objective.id;
 let entity=recipe.entities.find(e=>e.id===id);
 const visited=new Set();
 while(entity&&!visited.has(entity.id)){
  visited.add(entity.id);const missing=(entity.requires||[]).find(id=>!machines[id]?.complete&&!flags[id]);
  if(missing===undefined)break;
  const dependency=recipe.entities.find(e=>e.id===missing);if(!dependency)break;entity=dependency;
 }
 let target=entity?at(entity):recipe.boss?.id===id?{id,type:'boss',x:state.boss?.x??recipe.boss.p[0],z:state.boss?.z??recipe.boss.p[1],label:recipe.boss.name}:null;
 let instruction=entity?.id!==id?entity?.hint||objective.text:objective.text,action='solve';
 const sun=state.sun;
 if(entity?.type==='cradle'){
  action='haul';const inRing=sun&&distance(sun,target)<2.6;
  instruction=inRing?'The Sun is in its cradle. Come close and interact to restore this district.':player?.rope?.attached?'Haul the Sun into the gold ring.':'Take a rope beside the Sun, then haul it into the gold ring.';
 }else if(entity?.ropeRoute){
  const machine=machines[entity.id],wrapped=machine?.route?.length||0,post=wrapped<entity.ropeRoute.length&&recipe.props.find(p=>p.id===entity.ropeRoute[wrapped]);
  action=post?'wrap':'operate';
  if(post){target={id:post.id,type:'hook',x:post.p[0],z:post.p[2],label:`Post ${wrapped+1}`};instruction=`Keep your rope taut and circle post ${wrapped+1}. ${wrapped}/${entity.ropeRoute.length} wraps secured; your crew stays clear.`;}
  else instruction=`The rope route is ready. Turn ${entity.label||'the capstan'}: ${machine?.turns||0}/${entity.turns||3}. Interact to keep turning.`;
 }else if(entity?.type==='receiver'){
  const receiver=entity,mirrors=recipe.entities.filter(e=>['mirror','prismSocket'].includes(e.type)&&(!receiver.source||e.id===receiver.source)&&(!e.requires||e.requires.every(id=>machines[id]?.complete||flags[id])));
  const mirror=mirrors.sort((a,b)=>distance(at(a),target)-distance(at(b),target))[0];
  if(mirror){entity=mirror;target=at(mirror);action='mirror';instruction=`Turn ${mirror.label||'the mirror'} toward ${receiver.label||'the gold receiver'}. Bring the Sun close enough to power its beam.`;}
 }else if(entity?.type==='loadField'){action='support';}
 else if(['cargoSocket','counterweightLift'].includes(entity?.type)){action='cargo';}
 else if(['lever','valve','sluiceGate','crank','capstan','winch','gate','drawbridge','crane'].includes(entity?.type)){action='operate';}
 else if(target?.type==='boss'){action='fight';instruction=state.boss?.hint||objective.text;}
 return {objective,index,count:objectives.length,entity,target,action,instruction};
}

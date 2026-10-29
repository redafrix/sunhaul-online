const finiteVector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<=2000);
export function validateRecipe(map,catalog) {
 if(!map||!/^[a-z0-9_-]{1,32}$/.test(map.id)||!/^[a-z0-9_-]{1,32}$/.test(map.world||''))throw new Error('Invalid map identity');
 if(!finiteVector(map.size,2)||map.size.some(n=>n<32||n>400)||!Number.isInteger(map.seed))throw new Error('Invalid map size or seed');
 if(!map.terrain||!Number.isFinite(map.terrain.base))throw new Error('Terrain required');
 for(const p of map.terrain.plateaus||[])if(!Array.isArray(p.poly)||p.poly.length<3||p.poly.some(v=>!finiteVector(v,2))||!Number.isFinite(p.h))throw new Error('Invalid plateau');
 for(const p of map.terrain.paths||[])if(!Array.isArray(p.pts)||p.pts.length<2||p.pts.some(v=>!finiteVector(v,2))||!Number.isFinite(p.w)||p.w<=0)throw new Error('Invalid path');
 if(!Array.isArray(map.props)||map.props.length>5000)throw new Error('Invalid prop list');
 for(const p of map.props)if(!catalog[p.a]||!finiteVector(p.p,3)||p.r!==undefined&&!Number.isFinite(p.r)||p.s!==undefined&&!(Number.isFinite(p.s)&&p.s>0||finiteVector(p.s,3)&&p.s.every(n=>n>0)))throw new Error(`Invalid prop: ${p.a}`);
 for(const e of map.entities||[])if(typeof e.type!=='string'||!finiteVector(e.p,2))throw new Error('Invalid entity');
 for(const entries of Object.values(map.scatterSets||{}))for(const e of entries)if(!catalog[e.a])throw new Error(`Invalid scatter asset: ${e.a}`);
 if(map.mission?.zoneOrder&&map.id!=='w1m1')validateMission(map,catalog);
 return map;
}
function validateMission(map,catalog){
 if(map.size.some(n=>n<200)||!map.mainEnigma||map.mission.secrets?.length!==2)throw new Error('Mission needs its enigma, two secrets and a 200–320m recipe');
 const entities=new Map(),props=new Map(),known=new Set();
 for(const [list,dest]of [[map.entities,entities],[map.props,props]])for(const e of list){if(!e.id||dest.has(e.id))throw new Error(`Duplicate or missing id: ${e.id}`);dest.set(e.id,e);known.add(e.id);}
 if(map.boss){known.add(map.boss.id);for(let i=1;i<=4;i++)known.add(map.boss.id+'-phase-'+i);if(!catalog[map.boss.asset])throw new Error('Boss asset missing from catalog');}
 const ref=(id)=>{if(!known.has(id))throw new Error(`Unresolved mission reference: ${map.id}/${id}`);};
 for(const e of [...map.entities,...(map.boss?[map.boss]:[])]){
  for(const key of ['requires','links','supports','clues','mirrors','vines','channels','holes','receivers','props','cargo','ropeRoute'])for(const id of e[key]||[])ref(id);
  for(const key of ['source','sequence','stop','propId','target'])if(e[key])ref(e[key]);
  if(e.asset&&!catalog[e.asset])throw new Error(`Entity asset missing: ${e.asset}`);
 }
 for(const id of [...map.mission.secrets,map.mission.finale])ref(id);
 if(!map.borders?.dressed||!map.terrain.paths.some(p=>p.w>=6)||!map.terrain.paths.some(p=>p.w<=3.5)||!map.scatter.some(s=>s.clusters?.length))throw new Error('Mission needs dressed borders, path hierarchy and prop clusters');
 if(map.zones.length!==map.mission.zoneOrder.length)throw new Error('Zone order mismatch');
 for(const z of map.zones){const cradle=entities.get(z.cradle),landmark=props.get(z.landmark);if(!cradle||cradle.type!=='cradle'||cradle.restores!==z.id||!landmark||!z.composition)throw new Error(`Zone lacks a cradle, landmark or composition: ${z.id}`);const scale=Array.isArray(landmark.s)?landmark.s[1]:landmark.s??1,b=catalog[landmark.a].bounds;if((b.max[1]-b.min[1])*scale<=10)throw new Error(`Landmark must exceed 10m: ${z.id}`);}
 const done=new Set(),visiting=new Set(),visit=id=>{if(done.has(id))return;if(visiting.has(id))throw new Error(`Cyclic mission dependency: ${id}`);visiting.add(id);for(const dep of (entities.get(id)||map.boss?.id===id&&map.boss)?.requires||[])visit(dep);visiting.delete(id);done.add(id);};
 for(const e of map.entities)visit(e.id);
}

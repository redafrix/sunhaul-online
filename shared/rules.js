export const DIFFICULTIES={
 gentle:{label:'Gentle',description:'No light drain · slow, sparse Shades · unbreakable rope · hints',drain:0,shadeSpeed:.65,shadeCount:.45,shadeDamage:.5,fray:.4,hints:true,night:0},
 adventure:{label:'Adventure',description:'The intended journey · normal Shades · rope frays and recovers',drain:.16,shadeSpeed:1,shadeCount:1,shadeDamage:1,fray:1,hints:true,night:0},
 veteran:{label:'Veteran',description:'Aggressive Shades · fewer wells · faster drain and tangles',drain:.28,shadeSpeed:1.25,shadeCount:1.3,shadeDamage:1.3,fray:1.45,hints:false,night:0},
 eclipse:{label:'Eclipse',description:'Extinguishing the Sun ends the run · Brutes · night countdown',drain:.4,shadeSpeed:1.4,shadeCount:1.5,shadeDamage:1.5,fray:1.6,hints:false,night:900}
};
export const MUTATORS={
 'heavy-sun':{label:'Heavy Sun',description:'The Sun weighs more than twice as much.'},
 'short-ropes':{label:'Short Ropes',description:'Six-metre ropes demand a tighter crew.'},
 'endless-night':{label:'Endless Night',description:'Darkness persists and restored zones do not recharge the Sun.'},
 'glass-cannon-sun':{label:'Glass Cannon Sun',description:'A wider light radius; incoming Sun damage is multiplied.'},
 'wind-storm':{label:'Wind Storm',description:'Changing gusts push the physical Sun.'},
 'mirror-world':{label:'Mirror World',description:'The entire map is reflected, including puzzles and routes.'}
};
export const cleanMutators=value=>Array.isArray(value)?[...new Set(value.filter(id=>Object.hasOwn(MUTATORS,id)))].slice(0,6):[];
export function rulesFor(difficulty,mutators=[]){const id=Object.hasOwn(DIFFICULTIES,difficulty)?difficulty:'adventure',active=cleanMutators(mutators);return {...DIFFICULTIES[id],id,mutators:active,ropeMax:active.includes('short-ropes')?6:10,sunMass:active.includes('heavy-sun')?9:4,sunDamage:active.includes('glass-cannon-sun')?2.5:1,lightScale:active.includes('glass-cannon-sun')?1.25:1,night:DIFFICULTIES[id].night};}
export function configuredRecipe(recipe,mutators=[]){
 const active=cleanMutators(mutators);if(!active.includes('mirror-world')&&!active.includes('endless-night'))return recipe;
 const result=structuredClone(recipe);
 if(active.includes('mirror-world')){
  const points=new Set(['p','glyph','statue','a','b','tray','point','from','to','center','origin','destination','poly','pts','clusters']);
  function reflect(value,key='',parent=''){
   if(Array.isArray(value)){if(value.every(Number.isFinite)&&(points.has(key)||['starts','engines'].includes(parent))&&(value.length===2||value.length===3)){value[0]=-value[0];return;}value.forEach(v=>reflect(v,key,parent));}
   else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value)){if((k==='r'||k==='rotation')&&Number.isFinite(v))value[k]=-v;else if(k==='angle'&&Number.isFinite(v))value[k]=Math.PI-v;else reflect(v,k,key);}
  }
  reflect(result);
 }
 if(active.includes('endless-night'))result.darkness={...result.darkness,total:true};
 return result;
}

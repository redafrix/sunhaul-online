import { seeded,inPolygon,terrainHeight,pathDistance } from './map-math.js';
function weighted(rand,set){let n=rand()*set.reduce((n,e)=>n+(e.w??1),0);for(const e of set){n-=e.w??1;if(n<=0)return e.a;}return set.at(-1).a;}
export function scatterProps(recipe) {
 const rand=seeded(recipe.seed),result=[];
 for(const scatter of recipe.scatter||[]) {
  const set=recipe.scatterSets[scatter.set],poly=scatter.poly;if(!set?.length||!poly?.length)continue;
  const xs=poly.map(p=>p[0]),zs=poly.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  const spacing=scatter.spacing??2,buckets=new Map(),capacity=scatter.count??Math.floor((maxX-minX)*(maxZ-minZ)*(scatter.density??.03));
  const accepted=[];
  const canPlace=(x,z)=>{const bx=Math.floor(x/spacing),bz=Math.floor(z/spacing);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const p of buckets.get(`${bx+i},${bz+j}`)||[])if(Math.hypot(p[0]-x,p[1]-z)<spacing)return false;return true;};
  for(let tries=0;tries<capacity*90&&accepted.length<capacity;tries++) {
   let x,z;
   if(scatter.clusters?.length){const center=scatter.clusters[Math.floor(rand()*scatter.clusters.length)],a=rand()*Math.PI*2,r=Math.sqrt(rand())*(scatter.clusterRadius??5);x=center[0]+Math.cos(a)*r;z=center[1]+Math.sin(a)*r;}
   else {x=minX+rand()*(maxX-minX);z=minZ+rand()*(maxZ-minZ);}
   if(!inPolygon(x,z,poly)||!canPlace(x,z))continue;
   if(scatter.avoidPaths!==false&&(recipe.terrain.paths||[]).some(p=>pathDistance(x,z,p.pts)<p.w*.7))continue;
   if((recipe.clearings||[]).some(c=>Math.hypot(x-c.p[0],z-c.p[1])<c.radius))continue;
   const y=terrainHeight(recipe,x,z);if(y<(recipe.water?.level??-1)&&!scatter.underwater)continue;
   const key=`${Math.floor(x/spacing)},${Math.floor(z/spacing)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push([x,z]);accepted.push([x,z]);
   const scale=(scatter.scale?.[0]??.85)+rand()*((scatter.scale?.[1]??1.2)-(scatter.scale?.[0]??.85));
   result.push({a:weighted(rand,set),p:[x,y+(scatter.height??0),z],r:rand()*360,s:scale,scatter:true,...(scatter.collide===false?{collide:false}:{})});
  }
 }
 return result;
}

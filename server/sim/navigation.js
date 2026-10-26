import { terrainHeight,inPolygon } from '../../shared/map-math.js';
import { placements,footprint } from '../../shared/physics-geometry.js';
import { worldHeight } from '../../shared/world-math.js';
export class Navigation {
 constructor(recipe,catalog){this.recipe=recipe;this.cell=1.5;this.w=Math.ceil(recipe.size[0]/this.cell);this.h=Math.ceil(recipe.size[1]/this.cell);this.walkable=new Uint8Array(this.w*this.h);
  const solids=placements(recipe).filter(p=>p.collide!==false&&catalog[p.a].collider.type!=='none'&&!(p.dynamic??catalog[p.a].dynamic)).map(p=>footprint(p,catalog[p.a],.5));
  for(let j=0;j<this.h;j++)for(let i=0;i<this.w;i++){const p=this.point(i+j*this.w);this.walkable[i+j*this.w]=worldHeight(recipe,p.x,p.z)>(recipe.water?.level??-1)+.1&&!solids.some(s=>inPolygon(p.x,p.z,s.points.map(p=>[p.x,p.z])));}
  this.baseWalkable=this.walkable.slice();this.solids=solids;this.version='';
 }
 update(game){const key=this.recipe.entities.filter(e=>['vineNode','meltSocket','coolingChannel'].includes(e.type)&&game.machines[e.id]?.complete).map(e=>e.id).concat(game.destroyed||[]).join('|');if(key===this.version)return;this.version=key;const solids=this.solids.filter(s=>!game.destroyed.includes(s.id));for(let id=0;id<this.walkable.length;id++){const p=this.point(id);this.walkable[id]=worldHeight(this.recipe,p.x,p.z,game.machines)>(this.recipe.water?.level??-1)+.1&&!solids.some(s=>inPolygon(p.x,p.z,s.points.map(p=>[p.x,p.z])));}}
 point(id){return {x:(id%this.w+.5)*this.cell-this.recipe.size[0]/2,z:(Math.floor(id/this.w)+.5)*this.cell-this.recipe.size[1]/2};}
 index(p){const x=Math.max(0,Math.min(this.w-1,Math.floor((p.x+this.recipe.size[0]/2)/this.cell))),z=Math.max(0,Math.min(this.h-1,Math.floor((p.z+this.recipe.size[1]/2)/this.cell)));return z*this.w+x;}
 nearest(p){const id=this.index(p);if(this.walkable[id])return id;for(let r=1;r<9;r++)for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){const ix=id%this.w+x,iy=Math.floor(id/this.w)+y,n=iy*this.w+ix;if(ix>=0&&ix<this.w&&iy>=0&&iy<this.h&&this.walkable[n])return n;}return id;}
 route(from,to){
  const start=this.nearest(from),goal=this.nearest(to);if(start===goal)return [to];
  const open=[start],closed=new Set(),parent=new Map(),cost=new Map([[start,0]]),heuristic=id=>Math.abs(id%this.w-goal%this.w)+Math.abs(Math.floor(id/this.w)-Math.floor(goal/this.w));
  for(let budget=0;open.length&&budget<7000;budget++){
   let k=0;for(let i=1;i<open.length;i++)if(cost.get(open[i])+heuristic(open[i])<cost.get(open[k])+heuristic(open[k]))k=i;const id=open.splice(k,1)[0];
   if(id===goal){const path=[goal];while(path[0]!==start&&parent.has(path[0]))path.unshift(parent.get(path[0]));const points=path.slice(1).map(id=>this.point(id));if(this.walkable[this.index(to)])points.push({x:to.x,z:to.z});return points;}
   closed.add(id);const x=id%this.w,z=Math.floor(id/this.w);
   for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,n=nz*this.w+nx;if(nx<0||nx>=this.w||nz<0||nz>=this.h||!this.walkable[n]||closed.has(n))continue;const newCost=cost.get(id)+1;if(newCost<(cost.get(n)??Infinity)){parent.set(n,id);cost.set(n,newCost);if(!open.includes(n))open.push(n);}}
  }
  return [this.point(start)];
 }
}

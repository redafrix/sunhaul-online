import { inPolygon,segmentDistance } from './map-math.js';
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
export function intersects(a,b,c,d) {return cross(a,b,c)*cross(a,b,d)<-1e-7&&cross(c,d,a)*cross(c,d,b)<-1e-7;}
export function blocks(a,b,contact) {
 const pts=contact.points;
 const x=(a.x+b.x)/2,z=(a.z+b.z)/2,boundary=pts.some((p,i)=>segmentDistance(x,z,[p.x,p.z],[pts[(i+1)%pts.length].x,pts[(i+1)%pts.length].z])<.001);
 return pts.some((p,i)=>intersects(a,b,p,pts[(i+1)%pts.length]))||!boundary&&inPolygon(x,z,pts.map(p=>[p.x,p.z]));
}
export function pathLength(path){return path.slice(1).reduce((total,p,i)=>total+distance(path[i],p),0);}
function detour(a,b,c) {
 const pts=c.points,n=pts.length;let best=null,bestLength=Infinity;
 for(let i=0;i<n;i++){if(blocks(a,pts[i],c))continue;
  for(let j=0;j<n;j++){if(blocks(pts[j],b,c))continue;
   for(const direction of [-1,1]){
    const path=[];let k=i;
    for(let count=0;count<n;count++){path.push({...pts[k],id:c.id,vertex:k});if(k===j)break;k=(k+direction+n)%n;}
    if(path.at(-1).vertex!==j)continue;
    const total=pathLength([a,...path,b]);if(total<bestLength){best=path;bestLength=total;}
   }
  }
 }
 return best;
}
export function routeRope(a,b,previous,contacts) {
 let nodes=previous.filter(n=>contacts.some(c=>c.id===n.id)).map(n=>({...n,...contacts.find(c=>c.id===n.id).points[n.vertex]}));
 // A winding stays until the endpoint crosses back over the recorded corner.
 for(let pass=0;pass<3;pass++)for(let i=nodes.length-1;i>=0;i--){
  const left=nodes[i-1]||a,right=nodes[i+1]||b,node=nodes[i],turn=Math.sign(cross(left,node,right));
  if(!contacts.some(c=>blocks(left,right,c))&&(!node.turn||turn!==node.turn||Math.abs(cross(left,node,right))<.03))nodes.splice(i,1);
 }
 for(let iteration=0;iteration<16;iteration++){
  const path=[a,...nodes,b];let inserted=false;
  for(let i=0;i<path.length-1;i++){
   const contact=contacts.filter(c=>blocks(path[i],path[i+1],c)).sort((c,d)=>distance(path[i],c)-distance(path[i],d))[0];
   if(!contact)continue;const wrap=detour(path[i],path[i+1],contact);if(!wrap?.length)continue;
   wrap.forEach((node,k)=>node.turn=Math.sign(cross(wrap[k-1]||path[i],node,wrap[k+1]||path[i+1])));
   nodes.splice(i,0,...wrap);inserted=true;break;
  }
  if(!inserted||nodes.length>=24)break;
 }
 return {nodes,path:[a,...nodes,b],length:pathLength([a,...nodes,b])};
}

import { routeRope,distance,intersects } from '../../shared/rope-routing.js';
import { footprint } from '../../shared/physics-geometry.js';
export class Ropes {
 contacts(game) {
  const physics=game.physics,dynamic=[...physics.props.values()].filter(r=>r.f.ropeContact).map(r=>{const p=r.body.translation();return footprint({...r.p,p:[p.x,0,p.y],r:-r.body.rotation()*180/Math.PI},r.a,.13);});
  return [...physics.contacts,...dynamic,...(game.anchors||[])];
 }
 command(game,p,cmd) {
  const sun=game.sunPositionFor(p),r=p.rope;if(r.cutUntil>game.time&&cmd==='rope')return;
  if(cmd==='rope'){
   if(r.attached)p.rope={attached:false,tension:0,fray:r.fray||0,nodes:[]};
   else if(distance(p,sun)<3.7)p.rope={attached:true,tension:0,length:Math.min(3.2,game.rules.ropeMax*.5),max:game.rules.ropeMax,fray:0,nodes:[],path:[sun,{x:p.x,z:p.z}]};
  }
  if(cmd==='reel-in'&&r.attached)r.length=Math.max(2,r.length-.18);
  if(cmd==='reel-out'&&r.attached)r.length=Math.min(r.max,r.length+.18);
  if(cmd==='tie'&&r.attached){
   if(r.tied){r.tied=null;r.nodes=[];return;}
   const contact=this.contacts(game).filter(c=>distance(c,p)<2.6).sort((a,b)=>distance(a,p)-distance(b,p))[0];
   if(contact){const point=contact.points.reduce((a,b)=>distance(a,sun)<distance(b,sun)?a:b);r.tied={id:contact.id,x:point.x,z:point.z};}
  }
 }
 forces(game,dt) {
  const physics=game.physics,contacts=this.contacts(game),attached=[];
  for(const p of game.players.values()){
   const r=p.rope,sun=game.sunPositionFor(p);if(!r.attached)continue;
   if(r.tied&&!contacts.some(c=>c.id===r.tied.id)){r.tied=null;r.nodes=[];}
   const end=r.tied||{x:p.x+p.vx*dt,z:p.z+p.vz*dt},route=routeRope(sun,end,r.nodes||[],contacts);
   r.nodes=route.nodes;r.path=route.path;r.distance=route.length;r.tangle=r.grabUntil>game.time;r.tension=Math.min(1,Math.max(0,(route.length-r.length)/1.8));attached.push(p);
   if(!r.tied&&route.length>r.max){
    const last=route.path.at(-2),tail=distance(last,end)||1,reach=Math.max(.15,r.max-(route.length-tail));
    physics.move(p,{x:last.x+(end.x-last.x)*reach/tail-p.x,z:last.z+(end.z-last.z)*reach/tail-p.z});
   }
   r.fray=Math.max(0,(r.fray||0)-dt*.018);
   const hot=(game.recipe.surfaces||[]).some(s=>s.type==='heat'&&distance(p,{x:s.p[0],z:s.p[1]})<s.radius);
   if(hot&&p.hero!=='brann'&&!(p.shieldUntil>game.time)&&!(p.heatImmuneUntil>game.time))r.fray+=dt*.09*game.rules.fray;
  }
  for(let i=0;i<attached.length;i++)for(let j=i+1;j<attached.length;j++){
   if(attached[i].team!==attached[j].team)continue;const a=attached[i].rope,b=attached[j].rope,shared=a.nodes.some(n=>b.nodes.some(m=>m.id===n.id));
   const opposing=a.nodes.some(n=>b.nodes.some(m=>n.id===m.id&&n.turn&&m.turn&&n.turn!==m.turn));
   if(shared&&(a.path.slice(1).some((n,k)=>b.path.slice(1).some((m,l)=>intersects(a.path[k],n,b.path[l],m)))||opposing&&distance(a.path.at(-1),b.path.at(-1))<(game.difficulty==='veteran'||game.difficulty==='eclipse'?6:4)))a.tangle=b.tangle=true;
  }
  for(const p of attached){
   const r=p.rope,sun=game.sunPositionFor(p);if(r.fray>=1&&game.difficulty!=='gentle'){r.attached=false;r.snappedUntil=game.time+2;r.tension=0;continue;}
   const next=r.path[1],d=distance(sun,next)||1,stretch=Math.max(0,r.distance-r.length);let strength=Math.min(40,stretch*24)*(r.tangle?.5:1)*(1-r.fray*.35);
   if(p.hero==='mara'&&p.input.sprint)strength*=2;if(p.pullMultiplier)strength*=p.pullMultiplier;
   const pullers=attached.filter(a=>a.team===p.team&&!a.rope.tied).length;
   strength*=1/Math.sqrt(Math.max(1,pullers));strength*=p.racePull||1;game.sunBodyFor(p).applyImpulse({x:(next.x-sun.x)/d*strength*dt,y:(next.z-sun.z)/d*strength*dt},true);
  }
 }
}

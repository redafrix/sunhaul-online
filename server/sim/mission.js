import { terrainHeight } from '../../shared/map-math.js';
export class Mission {
 constructor(game){this.state={name:game.recipe.name,zone:0,complete:false,stars:0};game.mission=this.state;game.safeSpawn=at=>{for(let i=0;i<32;i++){const a=i*.73,r=2+Math.floor(i/8),p={x:at.x+Math.cos(a)*r,z:at.z+Math.sin(a)*r};if(terrainHeight(game.recipe,p.x,p.z)>(game.recipe.water?.level??-1)+.1&&game.physics.lineOfSight(at,p))return p;}return game.checkpoint||{x:2,z:14};};}
 after(game,dt){const mission=game.recipe.mission;if(!mission)return;
  const cache=game.machines['dock-cache'];if(cache?.active){cache.hold=(cache.hold||0)+dt;if(cache.hold>1.5&&!game.flags['dock-cache']){game.flags['dock-cache']=true;game.shards=(game.shards||0)+1;game.teamwork(15);}}
  this.state.zone=Math.min((mission.zoneOrder?.length||1)-1,(game.restored||[]).length);this.state.elapsed=game.time;this.state.secrets=(mission.secrets||[]).filter(id=>game.flags[id]).length;this.state.secretTotal=mission.secrets?.length||0;this.state.par=mission.par;
  const final=game.machines[mission.finale];if(final?.locked&&!this.state.complete){this.state.complete=true;this.state.finishedAt=game.time;game.teamwork(100);}
  if(this.state.complete)this.state.stars=1+(this.state.finishedAt<mission.par?1:0)+(this.state.secrets===this.state.secretTotal?1:0);
 }
 snapshot(){return {mission:this.state};}
}

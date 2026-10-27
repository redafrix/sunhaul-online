// Persistent mission routes share the authoritative navigator used by Pathfinder.
import { missionObjective } from '../../shared/mission-flow.js';
import { segmentDistance } from '../../shared/map-math.js';
export class Guidance {
 after(game) {
  if (game.recipe.mode) return;
  const player = [...game.players.values()].find(p => !p.bot && p.connected !== false);
  if (!player) return;
  const sun = game.sunPositionFor(player);
  const guide = missionObjective(game.recipe, {...game, sun}, player);
  if (!guide?.target || game.failed) {
   game.guidance = null;
   return;
  }
  const nav = game.systems.find(s => s.navigation).navigation;
  const key = `${game.runId}:${guide.index}:${guide.target.id}`;
  if (this.key !== key) {
   this.key = key;
   const spawn = game.recipe.entities.find(e => e.type === 'sunSpawn')?.p || [0,0];
   const anchor = game.checkpoint || {x:spawn[0],z:spawn[1]};
   this.corridor = [anchor,...nav.route(anchor,guide.target)];
   this.next = 0;
  }
  if (game.time < this.next) return;
  this.next = game.time + 1;
  const route = [sun,...nav.route(sun,guide.target)];
  let offRoute = Infinity;
  for (let i=1;i<this.corridor.length;i++) {
   const a=this.corridor[i-1], b=this.corridor[i];
   offRoute = Math.min(offRoute,segmentDistance(sun.x,sun.z,[a.x,a.z],[b.x,b.z]));
  }
  game.guidance = {route,updatedAt:game.time,target:guide.target,index:guide.index,offRoute,
   distance:route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-route[i].x,p.z-route[i].z),0),
   lost:offRoute>12&&[...game.players.values()].some(p=>p.rope.attached)};
 }
 snapshot(game) {return {guidance:game.guidance||null};}
}

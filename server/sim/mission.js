// Mission timing, ratings and cradle recovery are owned by the server.
import { terrainHeight } from '../../shared/map-math.js';
export class Mission {
 constructor(game) {
  this.state = { name: game.recipe.name, zone: 0, complete: false, stars: 0 };
  game.mission = this.state;
  game.safeSpawn = (at) => {
   for (let i = 0; i < 192; i++) {
    const a = i * 2.39996,
     r = i < 96 ? 2.6 + (i % 3) * .15 : 3.2 + Math.floor((i - 96) / 16) * .7;
    const p = { x: at.x + Math.cos(a) * r, z: at.z + Math.sin(a) * r };
    if (
     terrainHeight(game.recipe, p.x, p.z) > (game.recipe.water?.level ?? -1) + 0.1 &&
     game.physics.lineOfSight(at, p) &&
     [...game.players.values()].every(other => Math.hypot(other.x-p.x,other.z-p.z) > .8) &&
     game.physics.clearSpawn(p) &&
     !game.recipe.entities.some(e => e.type==='cradle' && Math.hypot(e.p[0]-p.x,e.p[1]-p.z)<2.4)
    )
     return p;
   }
   const spawn=game.recipe.entities.find(e=>e.type==='heroSpawn')?.p || [2,14];
   return {x:spawn[0],z:spawn[1]};
  };
  game.retryCheckpoint = () => this.recover(game);
  this.saved = null;
  this.lastSun = game.sunPositionFor();
  this.lastMotion = 0;
  this.lastCrew = 0;
  this.positions = new Map();
 }
 recover(game) {
  const spawn = game.recipe.entities.find((e) => e.type === 'sunSpawn')?.p || [0, 0];
  const at = game.checkpoint || { x: spawn[0], z: spawn[1] };
  if (this.saved) {
   for (const [id, state] of Object.entries(this.saved.machines))
    Object.assign(game.machines[id], structuredClone(state));
   game.flags = structuredClone(this.saved.flags);
   game.restored = structuredClone(this.saved.restored);
  } else {
   for (const s of Object.values(game.machines))
    Object.assign(s, { active: false, complete: false, locked: false, progress: 0, turns: 0, route: [] });
   game.flags = {};
   game.restored = [];
  }
  game.physics.sunBody.setTranslation({ x: at.x, y: at.z }, true);
  game.physics.sunBody.setLinvel({ x: 0, y: 0 }, true);
  Object.assign(game.sun, { radiance: 100, gutterFor: 0, mood: 'curious' });
  for (const p of game.players.values()) {
   const spot = game.safeSpawn(at);
   p.body.setTranslation({ x: spot.x, y: spot.z }, true);
   p.body.setNextKinematicTranslation({ x: spot.x, y: spot.z });
   game.physics.sync(p);
   Object.assign(p, {
    hp: 100,
    downedUntil: 0,
    vx: 0,
    vz: 0,
    rope: { attached: false, tension: 0 },
    facing: {x:(at.x-spot.x)/Math.hypot(at.x-spot.x,at.z-spot.z),z:(at.z-spot.z)/Math.hypot(at.x-spot.x,at.z-spot.z)},
    commands: [],
    input: { x: 0, z: 0 },
   });
  }
  const shades = game.systems.find((s) => s.shades);
  for (const s of shades.shades) game.physics.removePlayer(s);
  shades.shades.length = 0;
  for (const s of shades.spawns) s.next = game.time + 12;
  game.failed = false;
  game.failureReason = null;
  this.allDownAt = null;
  this.state.complete = false;
  this.state.recoveryAvailable = false;
  this.lastSun = { ...at };
  this.lastMotion = this.lastCrew = game.time;
 }
 after(game, dt) {
  const mission = game.recipe.mission;
  const crew = [...game.players.values()].filter((p) => p.connected !== false);
  for (const p of crew) {
   p.stats ??= { ropeTime: 0, strikes: 0, powers: 0 };
   if (p.rope.attached) p.stats.ropeTime += dt;
   if (p.castAt !== p.lastCountedCast && p.castAt !== undefined) {
    p.stats.powers++;
    p.lastCountedCast = p.castAt;
   }
   const old = this.positions.get(p.id);
   if (!old || Math.hypot(p.x - old.x, p.z - old.z) > 1) {
    this.positions.set(p.id, { x: p.x, z: p.z });
    this.lastCrew = game.time;
   }
  }
  const sun = game.sunPositionFor();
  if (Math.hypot(sun.x - this.lastSun.x, sun.z - this.lastSun.z) > 1) {
   this.lastSun = sun;
   this.lastMotion = game.time;
  }
  const charging = Object.values(game.machines).some((s) => s.active && !s.complete && s.progress > 0);
  this.state.recoveryAvailable = game.recipe.mode !== 'sun-race' && !charging && game.time - this.lastMotion > 20;
  if (crew.length && crew.every((p) => p.downedUntil > 0) && game.difficulty === 'eclipse') {
   this.allDownAt ??= game.time;
   if (game.time - this.allDownAt > 10) {
    game.failed = true;
    game.failureReason = 'Every Keeper has fallen. Return to the last cradle.';
   }
  } else this.allDownAt = null;
  if ((game.restored?.length || 0) !== (this.saved?.restored.length || 0)) {
   this.saved = structuredClone({ machines: game.machines, flags: game.flags, restored: game.restored });
  }
  if (!mission) return;
  const cache = game.machines['dock-cache'];
  if (cache?.active) {
   cache.hold = (cache.hold || 0) + dt;
   if (cache.hold > 1.5 && !game.flags['dock-cache']) {
    game.flags['dock-cache'] = true;
    game.shards = (game.shards || 0) + 1;
    game.teamwork(15);
   }
  }
  Object.assign(this.state, {
   zone: Math.min((mission.zoneOrder?.length || 1) - 1, (game.restored || []).length),
   elapsed: game.time,
   par: mission.par,
  });
  const final = game.machines[mission.finale];
  if (final?.locked && !this.state.complete) {
   Object.assign(this.state, {
    complete: true,
    finishedAt: game.time,
    radiance: game.finishRadiance ?? game.sun.radiance,
   });
   this.state.stars = 1 + (game.time <= mission.par ? 1 : 0) + (this.state.radiance >= 60 ? 1 : 0);
   for (const shade of game.shades) game.physics.removePlayer(shade);
   game.shades.length = 0;
   this.state.recoveryAvailable = false;
   game.teamwork(100);
  }
 }
 snapshot() {
  return { mission: this.state };
 }
}

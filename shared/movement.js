// Server and client share movement speeds, acceleration and action locks.
import { movementLocked, dodgeSpeed } from './hero-actions.js';
import { terrainHeight, terrainWeights, clamp } from './map-math.js';

export const STEP = 1 / 60;

export function terrainAt(recipe, x, z) {
  const height = terrainHeight(recipe, x, z);
  const weights = terrainWeights(recipe, x, z);
  const extra = (recipe.surfaces || []).find(surface => Math.hypot(x - surface.p[0], z - surface.p[1]) < surface.radius);
  return extra?.type || (height < (recipe.water?.level ?? -1) + .35 ? 'water' : weights[3] > .5 ? 'mud' : 'stone');
}

export function moveVelocity(player, input, recipe, dt = STEP) {
  player.sprint = !!input.sprint;
  if (movementLocked(player)) {
    player.vx = player.vz = 0;
    return { x: 0, z: 0 };
  }
  if (player.dodgeUntil > player.time) {
    const direction = player.dodgeDirection || player.facing;
    player.vx = direction.x * dodgeSpeed(player);
    player.vz = direction.z * dodgeSpeed(player);
    return { x: player.vx * dt, z: player.vz * dt };
  }
  if (player.dodgeDirection) {
    player.vx = player.vz = 0;
    player.dodgeDirection = null;
  }
  const distance = Math.hypot(input.x, input.z);
  const x = distance > 1 ? input.x / distance : input.x;
  const z = distance > 1 ? input.z / distance : input.z;
  const surface = player.waterUntil > player.time ? 'water' : terrainAt(recipe, player.x, player.z);
  const terrain = surface === 'mud' ? .6 : surface === 'water' && player.hero !== 'nerali' ? .7 : 1;
  const hauling = player.rope?.attached && !player.rope.tied;
  let speed = (hauling ? clamp(4.5 - (player.rope.tension || 0) * 2, 2.5, 4.5) : input.sprint ? 6 : 3.6) * terrain;
  if (player.cargoTow) speed = Math.min(speed, 4);
  if (player.hero === 'sera') speed *= 1.15;
  if (player.speedBoost) speed *= 1.2;
  const ramp = surface === 'ice' && player.hero !== 'nerali' ? .4
    : distance > .01 ? input.sprint ? .2 : .09 : .065;
  const blend = 1 - Math.exp(-dt / ramp);
  player.vx += (x * speed - player.vx) * blend;
  player.vz += (z * speed - player.vz) * blend;
  if (distance > .1) player.facing = { x: x / (Math.hypot(x, z) || 1), z: z / (Math.hypot(x, z) || 1) };
  const aim = Math.hypot(input.fx || 0, input.fz || 0);
  if (aim > .1) player.facing = { x: input.fx / aim, z: input.fz / aim };
  return { x: player.vx * dt, z: player.vz * dt };
}

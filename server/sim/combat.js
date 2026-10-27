// Authoritative target selection, bounded lunges and dodgeable enemy wind-ups.
import { distance } from "../../shared/rope-routing.js";
export function nearestEnemy(game, p, range, cone = false) {
  return [...game.shades,...(game.boss?.kind==='drownedKing'&&game.boss.active&&!game.boss.defeated&&!game.boss.dyingAt?[game.boss]:[])]
    .filter(
      (s) =>
        s.hp > 0 &&
        distance(p, s) <= range + (s.kind==='drownedKing'?2.5:0) &&
        game.physics.lineOfSight(p, s) &&
        (!cone ||
          distance(p, s) < 0.1 ||
          ((s.x - p.x) * p.facing.x + (s.z - p.z) * p.facing.z) /
            distance(p, s) >=
            0.5),
    )
    .sort((a, b) => distance(p, a) - distance(p, b))[0];
}
export function strike(game, p) {
  if (game.time < (p.attackReady || 0) || p.downedUntil > game.time) return;
  p.attackReady = game.time + 0.55;
  const target = nearestEnemy(game, p, 3.5, true);
  const aim = target ? { x: target.x - p.x, z: target.z - p.z } : p.facing;
  const length = Math.hypot(aim.x, aim.z) || 1,
    dx = aim.x / length,
    dz = aim.z / length;
  p.facing = { x: dx, z: dz };
  const travel = game.boss?.kind==='drownedKing'&&game.boss.active ? 0 : target ? Math.min(1.2, Math.max(0, length - (target.kind==='drownedKing'?4:1.25))) : 0;
  p.strikeLunge = {
    x: (dx * travel) / 0.12,
    z: (dz * travel) / 0.12,
    until: game.time + 0.12,
  };
  p.attackTarget = target?.id || null;
  if (target?.kind === 'drownedKing') {
    game.damageBoss(p,14);
  } else if (target) {
    target.hp -= target.type === "brute" ? 13 : 18;
    target.hitAt = game.time;
    target.stunUntil = Math.max(target.stunUntil, game.time + 0.18);
    target.knock = { x: dx * 2, z: dz * 2 };
    target.knockUntil = game.time + 0.12;
    p.stats ??= { ropeTime: 0, strikes: 0, powers: 0 };
    p.stats.strikes++;
    p.hitAt = game.time;
  }
  return true;
}
export function enemyStrike(game, s, nearest) {
  if (s.biting) {
    if (!s.wasBiting) {
      s.windupUntil = game.time + 0.5;
      s.attackAt = game.time;
      s.windup = 0.5;
    }
    s.wasBiting = true;
    return;
  }
  s.wasBiting = false;
  const brute = s.type === "brute",
    reach = brute ? 2.5 : s.type === "wisp" ? 2 : 1.5;
  if (s.strikePending && game.time >= s.windupUntil) {
    s.strikePending = false;
    for (const p of game.players.values()) {
      if (
        p.connected === false ||
        p.downedUntil > game.time ||
        p.dodgeUntil > game.time ||
        p.shieldUntil > game.time
      )
        continue;
      const shield =
        p.frontShieldUntil > game.time &&
        ((s.x - p.x) * p.facing.x + (s.z - p.z) * p.facing.z) /
          (distance(s, p) || 1) >
          0.2;
      if (
        !shield &&
        game.physics.lineOfSight(s, p) &&
        distance(p, s.attackTarget) < (brute ? 2.5 : 1.4) &&
        distance(p, s) < reach + 1
      ) {
        p.hp -=
          (brute ? 24 : 10) *
          game.rules.shadeDamage *
          (0.8 + 0.2 * game.keeperCount());
        p.hurtAt = game.time;
      }
    }
  }
  if (
    nearest &&
    game.physics.lineOfSight(s, nearest) &&
    distance(s, nearest) < reach &&
    game.time >= (s.strikeReady || 0)
  ) {
    s.windup = brute ? 0.6 : 0.5;
    s.attackAt = game.time;
    s.windupUntil = game.time + s.windup;
    s.strikeReady = game.time + (brute ? 2.4 : 1.4);
    s.strikePending = true;
    s.attackTarget = { x: nearest.x, z: nearest.z };
    const d = distance(s, nearest) || 1;
    s.facing = { x: (nearest.x - s.x) / d, z: (nearest.z - s.z) / d };
  }
}

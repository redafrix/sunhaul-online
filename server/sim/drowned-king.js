// Server-owned headland encounter: light exposure, fair tells, phases and recovery.
import { distance } from "../../shared/rope-routing.js";
import { terrainHeight } from "../../shared/map-math.js";
import { ABILITIES } from "../../shared/heroes.js";
const moves = ["slam", "sweep", "summon", "ink_wave", "eclipse"];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function headlandCheckpoint(game) {
  if (game.recipe.id !== "w1m1") return;
  for (const id of [
    "first-light",
    "harbour-capstan",
    "market-cradle",
    "beacon-receiver",
  ]) {
    Object.assign(game.machines[id], {
      active: true,
      complete: true,
      locked: true,
      progress: 1,
    });
  }
  game.machines["beacon-mirror"].angle = 0;
  game.restored = ["zone_quay", "zone_market"].map((id) => ({
    id,
    x: 0,
    z: id === "zone_quay" ? 0 : -59,
    radius: 22,
    at: game.time,
  }));
  game.checkpoint = { x: 0, z: -94 };
  game.physics.sunBody.setTranslation({ x: 0, y: -94 }, true);
  game.physics.sunBody.setLinvel({ x: 0, y: 0 }, true);
}
export class DrownedKing {
  constructor(game) {
    const e = game.recipe.boss;
    this.spec = e;
    this.state = {
      id: e.id,
      kind: e.kind,
      name: e.name,
      x: e.p[0],
      z: e.p[1],
      active: false,
      defeated: false,
      phase: 0,
      hp: 1,
      maxHP: 1,
      progress: 0,
      exposed: false,
      nextAttack: 0,
      serial: 0,
      metrics: {
        attacksPressed: 0,
        hits: 0,
        damage: 0,
        playerDamage: 0,
        exposedSeconds: 0,
        phases: [],
        moves: [],
        interrupts: 0,
        resets: 0,
      },
    };
    game.boss = this.state;
    game.damageBoss = (p, damage) => this.damage(game, p, damage);
  }
  maxHP(game) {
    return (
      (game.difficulty === "gentle"
        ? 1850
        : game.difficulty === "eclipse"
          ? 3550
          : 2600) *
      (1 + 0.65 * (game.keeperCount() - 1))
    );
  }
  damage(game, p, amount) {
    const s = this.state;
    if (
      !s.active ||
      s.defeated ||
      s.dyingAt ||
      s.introUntil > game.time ||
      s.retreatUntil > game.time ||
      amount <= 0
    )
      return false;
    if (!s.exposed) {
      p.bounceAt = game.time;
      if (!p.kingHinted) {
        p.hint = "Bring the Sun closer!";
        p.kingHinted = true;
      }
      return false;
    }
    const damage = Math.min(s.hp, amount);
    s.hp -= damage;
    s.hitAt = p.hitAt = game.time;
    s.metrics.hits++;
    s.metrics.damage += damage;
    p.stats ??= { ropeTime: 0, strikes: 0, powers: 0 };
    p.stats.strikes++;
    if (
      s.attack?.kind === "eclipse" &&
      s.attack.until > game.time &&
      game.time >= s.attack.at
    ) {
      s.metrics.interrupts++;
      s.interruptedAt = game.time;
      s.attack.until = game.time;
      s.nextAttack = game.time + 2.2;
      game.sun.radiance = Math.min(100, game.sun.radiance + 12);
      game.teamwork(12);
    }
    if (s.hp <= 0) {
      s.hp = 0;
      s.dyingAt = game.time;
      s.attack = null;
      s.metrics.timeToKill = game.time - s.startedAt;
      s.metrics.kills = 1;
      game.sun.radiance = 100;
      for (const shade of game.shades) shade.hp = 0;
    }
    return true;
  }
  command(game, p, cmd) {
    const s = this.state;
    if (cmd === "attack") s.metrics.attacksPressed++;
    if (
      !cmd.startsWith("ability-") ||
      p.castAt !== game.time ||
      p.kingCastAt === p.castAt
    )
      return;
    p.kingCastAt = p.castAt;
    const spec = ABILITIES[p.hero]?.[p.castSlot];
    if (!spec?.damage) return;
    const origin = spec.type === "beam" ? game.sunPositionFor(p) : p;
    if (distance(origin, s) > (spec.range || spec.radius || 3) + 2.5) return;
    const d = distance(p, s) || 1;
    if (
      spec.type === "cone" &&
      ((s.x - p.x) * p.facing.x + (s.z - p.z) * p.facing.z) / d < 0.5
    )
      return;
    this.damage(game, p, spec.damage);
  }
  begin(game) {
    const s = this.state;
    s.active = true;
    s.startedAt = game.time;
    s.introUntil = game.time + 2.5;
    s.maxHP = s.hp = this.maxHP(game);
    s.nextAttack = s.introUntil + 1;
    s.nextChannel = s.introUntil + 22;
    s.metrics.phases.push({ phase: 1, at: game.time });
    game.checkpoint = { x: 0, z: -94 };
    for (const p of game.players.values()) {
      p.hp = 100;
      p.downedUntil = 0;
    }
    game.saveCheckpoint?.();
    // The arena owns its adds; existing harbour spawners cannot flood the climax.
    for (const shade of game.shades) shade.hp = 0;
  }
  recover(game) {
    const s = this.state;
    s.metrics.resets++;
    s.hp = s.maxHP * (1 - s.phase / 3);
    s.attack = null;
    s.retreatUntil = game.time + 4;
    s.z = this.spec.p[1] - 3;
    s.nextAttack = game.time + 5;
    s.nextChannel = game.time + 20;
    game.sun.radiance = 70;
    game.sun.gutterFor = 0;
    game.failed = false;
    for (const shade of game.shades) if (shade.kingAdd) shade.hp = 0;
    for (const p of game.players.values())
      p.hint = "The King retreats. Bring the Sun close again.";
  }
  after(game, dt) {
    const s = this.state;
    if (s.defeated) return;
    const sun = game.sunPositionFor();
    if (!s.active) {
      if (sun.z < -90 && game.machines["beacon-receiver"]?.complete)
        this.begin(game);
      else return;
    }
    if (s.dyingAt) {
      if (game.time - s.dyingAt >= 6) {
        s.defeated = true;
        s.defeatedAt = game.time;
        s.progress = 1;
        game.flags[s.id] = true;
        game.sun.radiance = 100;
        game.teamwork(100);
      }
      return;
    }
    const max = this.maxHP(game);
    if (max !== s.maxHP) {
      s.hp *= max / s.maxHP;
      s.maxHP = max;
    }
    s.exposed =
      distance(sun, s) <= 8 &&
      game.sun.radiance > 0 &&
      !(s.retreatUntil > game.time);
    if (s.exposed) s.metrics.exposedSeconds += dt;
    s.progress = 1 - s.hp / s.maxHP;
    s.hint =
      s.attack?.kind === "eclipse" && s.attack.until > game.time
        ? "Eclipse: bring the Sun close, then strike."
        : s.exposed
          ? "Exposed. Strike the King. Dodge the purple marks."
          : "Haul the Sun within 8 m. Light breaks his armour.";
    const washedAway =
      terrainHeight(game.recipe, sun.x, sun.z) <
      (game.recipe.water?.level ?? -1) - 0.1;
    if (washedAway) {
      game.physics.sunBody.setTranslation({ x: s.x, y: -107 }, true);
      game.physics.sunBody.setLinvel({ x: 0, y: 0 }, true);
      s.metrics.washbacks = (s.metrics.washbacks || 0) + 1;
      for (const p of game.players.values())
        p.hint = "The tide returns the Sun. Bring it close again.";
    }
    if (game.sun.radiance <= 0) this.recover(game);
    if (game.time < s.introUntil || s.retreatUntil > game.time) return;
    s.z = this.spec.p[1];
    const phase = s.hp / s.maxHP <= 0.33 ? 2 : s.hp / s.maxHP <= 0.66 ? 1 : 0;
    if (phase > s.phase) {
      s.phase = phase;
      s.phaseAt = game.time;
      s.metrics.phases.push({ phase: phase + 1, at: game.time });
      s.nextChannel = game.time + 1.5;
      s.attack = null;
      s.nextAttack = game.time + 1.5;
    }
    const a = s.attack;
    if (a && game.time >= a.at && a.until > game.time) {
      if (a.kind === "eclipse") {
        const shield = game.effects.some(
          (e) =>
            e.kind === "bastion" &&
            e.until > game.time &&
            distance(e, sun) < e.radius,
        );
        if (!shield)
          game.sun.radiance = Math.max(
            0,
            game.sun.radiance -
              dt *
                (game.difficulty === "gentle"
                  ? 5
                  : game.difficulty === "eclipse"
                    ? 11
                    : 8),
          );
      } else if (!a.hit) {
        a.hit = true;
        if (a.kind === "summon") this.summon(game);
        else this.impact(game, a);
      }
    }
    if ((!a || a.until <= game.time) && game.time >= s.nextAttack)
      this.telegraph(game);
    // Only travel along the shore between attacks; the combat marks remain fixed.
    if (!s.attack || s.attack.until <= game.time) {
      const goal = Math.sin(game.time * 0.2) * 3;
      const dx = clamp(goal - s.x, -dt * 0.85, dt * 0.85);
      s.vx = dx / dt;
      s.x += dx;
    } else s.vx = 0;
  }
  telegraph(game) {
    const s = this.state;
    const crew = [...game.players.values()].filter(
      (p) => p.connected !== false && !p.downedUntil,
    );
    const p =
      crew[s.serial % Math.max(1, crew.length)] || game.sunPositionFor();
    let kind = moves[s.serial % 5];
    if (game.time >= s.nextChannel) kind = "eclipse";
    const windup = Number((1.2 - s.phase * 0.15).toFixed(2));
    s.serial++;
    const a = {
      kind,
      id: s.serial,
      x: p.x,
      z: p.z,
      originX: s.x,
      originZ: s.z,
      radius: 3.2,
      at: game.time + windup,
      start: game.time,
      windup,
      until: game.time + windup + 1.2,
    };
    if (kind === "sweep") Object.assign(a, { x: s.x, z: s.z + 2, radius: 8 });
    if (kind === "ink_wave")
      Object.assign(a, {
        x: 0,
        z: clamp(p.z, -110, -96),
        width: 36,
        depth: 2.4,
      });
    if (kind === "summon") Object.assign(a, { x: s.x - 5, z: -110 });
    if (kind === "eclipse") {
      a.until = game.time + 3600;
      s.nextChannel =
        game.time + (s.phase === 0 ? 24 : s.phase === 1 ? 18 : 13);
    }
    s.attack = a;
    s.nextAttack =
      a.until + (game.difficulty === "gentle" ? 2.8 : 1.8) - s.phase * 0.25;
    s.metrics.moves.push({ kind, at: game.time, windup });
  }
  summon(game) {
    const s = this.state;
    const system = game.systems.find((v) => v.shades);
    const count = s.phase > 0 ? 3 : 2;
    for (
      let i = 0;
      i < count && game.shades.filter((v) => v.kingAdd).length < 6;
      i++
    ) {
      const shade = system.spawn(
        game,
        "lurker",
        s.x - 5 + i * 4,
        -110,
        "zone_lighthouse",
      );
      shade.kingAdd = true;
    }
  }
  impact(game, a) {
    const s = this.state;
    for (const p of game.players.values()) {
      if (
        p.connected === false ||
        p.downedUntil > game.time ||
        p.dodgeUntil > game.time ||
        p.shieldUntil > game.time ||
        p.frontShieldUntil > game.time
      )
        continue;
      const hit =
        a.kind === "ink_wave"
          ? Math.abs(p.z - a.z) < a.depth / 2 && Math.abs(p.x) < 18
          : a.kind === "sweep"
            ? distance(p, a) < 8 && p.z > a.originZ
            : distance(p, a) < a.radius;
      if (!hit) continue;
      const damage =
        (a.kind === "slam" ? 24 : a.kind === "sweep" ? 18 : 22) *
        (game.difficulty === "gentle"
          ? 0.6
          : game.difficulty === "eclipse"
            ? 1.35
            : 1);
      p.hp = Math.max(0, p.hp - damage);
      p.hurtAt = game.time;
      s.metrics.playerDamage += damage;
    }
  }
  snapshot() {
    return { boss: this.state };
  }
}

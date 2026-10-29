// Shared action windows match the shipped v8 clip durations and authored release markers.
// Movement and dodge cancellation use these same windows on the server and predicted client.
export const HERO_ACTIONS = {
  brann: {
    attack1: {"seconds": 1},
    attack2: {"seconds": 1},
    attack3: {"seconds": 1},
    hurt: {"seconds": 1.5},
    castQ: {"seconds": 1.4, "release": 0.45},
    castE: {"seconds": 1.6, "release": 0.45},
    castR: {"seconds": 2.2, "release": 0.45},
  },
  mara: {
    attack1: {"seconds": 1},
    attack2: {"seconds": 1},
    attack3: {"seconds": 1},
    hurt: {"seconds": 1.5},
    castQ: {"seconds": 1.75, "release": 0.446},
    castE: {"seconds": 1.5, "release": 0.45},
    castR: {"seconds": 2.5, "release": 0.448},
  },
  sera: {
    attack1: {"seconds": 1.2},
    attack2: {"seconds": 0.8718},
    attack3: {"seconds": 0.8571},
    hurt: {"seconds": 1.3},
    castQ: {"seconds": 1.3333, "release": 0.19},
    castE: {"seconds": 1.5333, "release": 0.29},
    castR: {"seconds": 2.3667, "release": 0.61},
  },
};
export const DODGE_SECONDS = .45;

export function actionActive(player, now = player.time || 0) {
  return player.action && player.action.until > now;
}

export function movementLocked(player, now = player.time || 0) {
  return !!(actionActive(player, now) && player.action.kind !== 'dodge'
    || player.channel?.until > now);
}

export function beginAction(player, kind, motion, now, token) {
  const timing = kind === 'dodge' ? { seconds: DODGE_SECONDS } : HERO_ACTIONS[player.hero]?.[motion];
  if (!timing) return null;
  player.actionSerial = (player.actionSerial || 0) + 1;
  player.action = { kind, motion, at: now, until: now + timing.seconds,
    seconds: timing.seconds, id: `${kind}:${token ?? now}` };
  player.vx = player.vz = 0;
  return player.action;
}

export function dodge(player, now, token, direction = player.facing) {
  if (player.downedUntil > now || now < (player.dodgeReady || 0)
    || actionActive(player, now) && player.action.kind === 'cast' || player.channel?.until > now) return false;
  const length = Math.hypot(direction?.x || 0, direction?.z || 0);
  if (length > .1) player.facing = { x: direction.x / length, z: direction.z / length };
  player.dodgeDirection = { ...player.facing };
  player.pendingStrike = null;
  player.pendingCast = null;
  player.dash = null;
  player.dodgeUntil = now + DODGE_SECONDS;
  player.dodgeReady = now + 3;
  beginAction(player, 'dodge', 'roll', now, token);
  return true;
}

export function hurt(player, now) {
  if (!HERO_ACTIONS[player.hero] || !player.hurtAt || player.hurtAt <= (player.handledHurtAt || 0)) return;
  player.handledHurtAt = player.hurtAt;
  if (player.dodgeUntil > now) return;
  player.pendingStrike = null;
  player.pendingCast = null;
  player.dash = null;
  if (player.hp <= 0 || player.downedUntil > now) { player.action = null; return; }
  beginAction(player, 'hurt', 'hurt', now, player.hurtAt);
}

// Predict a movement lock immediately; server validation remains authoritative for the action and its effect.
export function predictAction(player, packet) {
  const now = player.time;
  if (player.hp <= 0 || player.downedUntil > now) return;
  for (const command of packet.commands) {
    if (command === 'dodge') {
      dodge(player, now, packet.seq, Math.hypot(packet.x, packet.z) > .1 ? packet : player.facing);
      continue;
    }
    if (actionActive(player, now)) continue;
    if (command === 'attack' && now >= (player.attackReady || 0)) {
      const combo = (player.attackCombo || 0) % 3 + 1;
      const action = beginAction(player, 'attack', `attack${combo}`, now, packet.seq);
      if (action) {
        player.attackCombo = combo;
        player.attackReady = action.until;
      }
    }
    if (command.startsWith('ability-')) {
      const slot = command.slice(8).toUpperCase();
      if (now < (player.cooldowns?.[slot] || 0) || slot === 'R' && (player.ultimate || 0) < 100) continue;
      beginAction(player, 'cast', `cast${slot}`, now, packet.seq);
    }
  }
}

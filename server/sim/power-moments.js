// Optional discoveries award real shared Dawn Shards on contact with their visible pickups.
import { distance } from '../../shared/rope-routing.js';
export class PowerMoments {
  constructor(game) {
    this.spec = game.recipe.powerMoments;
    this.state = { shortcut: false, jetty: false, ramp: false };
  }
  after(game) {
    if (!this.spec) return;
    this.state.shortcut = this.spec.shortcut.crates.every(id => game.destroyed.includes(id));
    const ramp = this.spec.ramp;
    this.state.anchorHeld = [...game.players.values()].some(player =>
      player.connected !== false && player.rope.tied && game.anchors.some(anchor => anchor.id === player.rope.tied.id));
    const pickups = [
      { id: 'jetty', p: this.spec.jetty.shard, height: .72 },
      { id: 'ramp', p: [ramp.b[0], ramp.b[1] - .8], height: .81 + ramp.rise },
    ];
    for (const pickup of pickups) {
      if (this.state[pickup.id]) continue;
      const player = [...game.players.values()].find(player => player.connected !== false
        && player.hp > 0 && !(player.downedUntil > game.time)
        && distance(player, { x: pickup.p[0], z: pickup.p[1] }) < 1.25
        && Math.abs(game.physics.floor(player.x, player.z) - pickup.height) < .65);
      if (!player) continue;
      this.state[pickup.id] = true;
      game.shards = (game.shards || 0) + 1;
      player.hint = 'Dawn Shard found. Your crew shares the reward.';
      game.teamwork(15);
    }
  }
  snapshot() { return { powerMoments: this.state }; }
}

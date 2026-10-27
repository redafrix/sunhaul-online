// Optional M1 power discoveries use the existing crates, grapple and rope stakes.
import { distance } from "../../shared/rope-routing.js";
export class PowerMoments {
  constructor(game) {
    this.spec = game.recipe.powerMoments;
    this.state = { shortcut: false, jetty: false, ramp: false };
  }
  after(game, dt) {
    if (!this.spec) return;
    this.state.shortcut = this.spec.shortcut.crates.every((id) =>
      game.destroyed.includes(id),
    );
    const jetty = this.spec.jetty;
    for (const p of game.players.values()) {
      if (
        !this.state.jetty &&
        p.hero === "sera" &&
        distance(p, { x: jetty.shard[0], z: jetty.shard[1] }) < 1.6
      ) {
        this.state.jetty = true;
        game.shards = (game.shards || 0) + 1;
        p.hint = "Dawn Shard found. Grapple back across the jetty.";
        game.teamwork(15);
      }
    }
    const ramp = this.spec.ramp;
    const sun = game.sunPositionFor();
    const held = [...game.players.values()].some(
      (p) => p.rope.tied && game.anchors.some((a) => a.id === p.rope.tied.id),
    );
    if (
      held &&
      Math.abs(sun.x - ramp.b[0]) < ramp.width / 2 &&
      sun.z < ramp.a[1] - 3.5 &&
      sun.z > ramp.b[1] - 3.5
    ) {
      this.state.heldFor = (this.state.heldFor || 0) + dt;
      if (!this.state.ramp && this.state.heldFor > 3) {
        this.state.ramp = true;
        game.shards = (game.shards || 0) + 1;
        game.teamwork(15);
        for (const p of game.players.values())
          if (p.hero === "mara")
            p.hint =
              "Anchor holds. Dawn Shard found. Take your rope to continue.";
      }
    }
    this.state.anchorHeld = held;
  }
  snapshot() {
    return { powerMoments: this.state };
  }
}

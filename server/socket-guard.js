// Validate socket envelopes before handlers can coerce attacker-controlled objects.
const strings = [
  "room",
  "token",
  "map",
  "mode",
  "hero",
  "skin",
  "name",
  "difficulty",
];
const numbers = ["teamSize", "aiKeepers"];
const callbacksOnly = new Set([
  "restart_mission",
  "return_sun",
  "next_mission",
]);
const objects = new Set(["join_room", "select_mission", "crew_options"]);
export function listenGuard(socket) {
  return (event, handler) =>
    socket.on(event, (...args) => {
      if (event === "disconnect") return handler(...args);
      const ack = typeof args.at(-1) === "function" ? args.at(-1) : () => {};
      if (callbacksOnly.has(event)) return handler(ack);
      const data = args[0];
      if (objects.has(event)) {
        if (!data || typeof data !== "object" || Array.isArray(data))
          return ack({ ok: false, error: "Invalid crew request." });
        if (
          strings.some(
            (key) =>
              data[key] !== undefined &&
              (typeof data[key] !== "string" || data[key].length > 128),
          ) ||
          numbers.some(
            (key) => data[key] !== undefined && !Number.isFinite(data[key]),
          ) ||
          (data.mutators !== undefined &&
            (!Array.isArray(data.mutators) ||
              data.mutators.length > 6 ||
              data.mutators.some((value) => typeof value !== "string")))
        )
          return ack({ ok: false, error: "Invalid crew choices." });
        return handler(data, ack);
      }
      handler(data);
    });
}

// Monthly outbound traffic meter with an optional hard cap (TRAFFIC_CAP_GB) so a free host can never be overrun.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = process.env.TRAFFIC_FILE || '/tmp/sunhaul-traffic.json';
const CAP = Number(process.env.TRAFFIC_CAP_GB || 0) * 1e9;
const month = () => new Date().toISOString().slice(0, 7);

export function trackTraffic(server) {
  let state = { month: month(), bytes: 0 };
  try { const saved = JSON.parse(readFileSync(FILE, 'utf8')); if (saved.month === state.month) state = saved; } catch {}
  const sockets = new Map();
  server.on('connection', (socket) => {
    sockets.set(socket, 0);
    socket.on('close', () => { state.bytes += socket.bytesWritten - sockets.get(socket); sockets.delete(socket); });
  });
  const flush = () => {
    for (const [socket, counted] of sockets) { state.bytes += socket.bytesWritten - counted; sockets.set(socket, socket.bytesWritten); }
    if (state.month !== month()) state = { month: month(), bytes: 0 };
    try { writeFileSync(FILE, JSON.stringify(state)); } catch {}
  };
  setInterval(flush, 15000).unref();
  return {
    get gigabytes() { return state.bytes / 1e9; },
    // New crews are refused near the cap; players already in a game finish normally.
    get full() { return CAP > 0 && state.bytes >= CAP * 0.95; },
  };
}

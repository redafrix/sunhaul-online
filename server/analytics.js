// Anonymous play analytics: visitors (random browser id), sessions (join → leave), time played, heroes, devices.
// Persists to /tmp and restores from the GitHub snapshot branch (saved by an Action), since free hosts wipe disks.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = process.env.STATS_FILE || '/tmp/sunhaul-stats.json';
const SNAPSHOT = process.env.STATS_SNAPSHOT_URL || 'https://raw.githubusercontent.com/redafrix/sunhaul-online/stats-data/stats.json';
const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const clean = (v, max = 40) => (typeof v === 'string' ? v.replace(/[^\w-]/g, '').slice(0, max) : '');

export function createAnalytics(traffic) {
  let state = { since: Date.now(), visitors: {}, sessions: [], days: {}, traffic: null };
  const live = new Map();
  const merge = (saved) => {
    if (!saved?.visitors) return;
    state = { ...state, ...saved, sessions: saved.sessions || [], days: saved.days || {} };
    if (saved.traffic) traffic.restore?.(saved.traffic);
  };
  try { merge(JSON.parse(readFileSync(FILE, 'utf8'))); } catch {
    fetch(SNAPSHOT, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(merge).catch(() => {});
  }
  const today = () => (state.days[day()] ??= { visitors: [], sessions: 0, seconds: 0 });
  function end(socket) {
    const s = live.get(socket.id);
    if (!s) return;
    live.delete(socket.id);
    s.end = Date.now();
    s.seconds = Math.round((s.end - s.start) / 1000);
    const v = state.visitors[s.visitor];
    if (v) { v.seconds += s.seconds; v.last = s.end; }
    today().seconds += s.seconds;
    state.sessions.push(s);
    if (state.sessions.length > 2000) state.sessions.splice(0, state.sessions.length - 2000);
  }
  const save = () => {
    state.traffic = traffic.snapshot?.() || null;
    try { writeFileSync(FILE, JSON.stringify(state)); } catch {}
  };
  setInterval(save, 30000).unref();
  return {
    start(socket, data, result, hero) {
      end(socket);
      const ua = socket.handshake?.headers?.['user-agent'] || '';
      const visitor = clean(data?.visitor) || `anon-${socket.id.slice(0, 8)}`;
      const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'phone' : 'desktop';
      const v = (state.visitors[visitor] ??= { first: Date.now(), last: Date.now(), visits: 0, seconds: 0, heroes: {}, device });
      v.visits++;
      v.last = Date.now();
      v.heroes[hero] = (v.heroes[hero] || 0) + 1;
      const t = today();
      if (!t.visitors.includes(visitor)) t.visitors.push(visitor);
      t.sessions++;
      live.set(socket.id, { visitor, start: Date.now(), hero, mode: clean(data?.mode) || 'solo', device, room: result.room });
    },
    end,
    report() {
      const now = Date.now();
      const current = [...live.values()].map(s => ({ ...s, seconds: Math.round((now - s.start) / 1000), live: true }));
      return { since: state.since, now, visitors: state.visitors, days: state.days, sessions: [...state.sessions.slice(-300), ...current], online: current.length, traffic: traffic.snapshot?.() };
    },
  };
}

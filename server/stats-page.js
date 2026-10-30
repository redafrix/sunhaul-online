// The /stats dashboard: bandwidth left this month, players online, visitors, sessions and time played.
const RENDER_FREE_GB = 5;
const esc = (v) => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const time = (t) => new Date(t).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' });
const dur = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);

export function statsPage(r) {
  const used = (r.traffic?.bytes || 0) / 1e9;
  const left = Math.max(0, RENDER_FREE_GB - used);
  const pct = Math.min(100, (used / RENDER_FREE_GB) * 100);
  const visitors = Object.entries(r.visitors).sort((a, b) => b[1].last - a[1].last);
  const totalSeconds = visitors.reduce((n, [, v]) => n + v.seconds, 0);
  const totalVisits = visitors.reduce((n, [, v]) => n + v.visits, 0);
  const days = Object.entries(r.days).sort().reverse().slice(0, 14);
  const fav = (h) => Object.entries(h || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || '–';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="30"><meta name="robots" content="noindex"><title>SUNHAUL · Stats</title>
<style>body{margin:0;padding:24px;background:#14232d;color:#efe3c8;font:14px/1.5 system-ui,sans-serif}h1{margin:0 0 4px;color:#e8c25a;letter-spacing:3px}
h2{margin:28px 0 8px;color:#e8c25a;font-size:16px;letter-spacing:2px;text-transform:uppercase}.cards{display:flex;flex-wrap:wrap;gap:12px}
.card{background:#1d3240;border:1px solid #c9a35a55;border-radius:12px;padding:14px 18px;min-width:150px}.card b{display:block;font-size:26px;color:#fff3c6}
.bar{height:12px;border-radius:8px;background:#0c161d;overflow:hidden;margin-top:8px;width:320px;max-width:100%}.bar i{display:block;height:100%;background:${pct > 85 ? '#e0603a' : pct > 60 ? '#e8b84a' : '#5fbf7a'};width:${pct.toFixed(1)}%}
table{border-collapse:collapse;width:100%;max-width:1100px}td,th{padding:6px 10px;border-bottom:1px solid #ffffff14;text-align:left;white-space:nowrap}th{color:#c9a35a;font-weight:600}
.live{color:#5fbf7a;font-weight:700}.muted{opacity:.6}</style></head><body>
<h1>SUNHAUL · STATS</h1><div class="muted">Updated ${time(r.now)} (Paris) · refreshes every 30 s · anonymous visitor IDs (random per browser), no personal data</div>
<h2>Render bandwidth this month (${esc(r.traffic?.month || '')})</h2>
<div class="cards"><div class="card">Used<b>${used.toFixed(2)} GB</b></div><div class="card">Left of ${RENDER_FREE_GB} GB<b>${left.toFixed(2)} GB</b>
<div class="bar"><i></i></div></div><div class="card">Game stops new crews at<b>${r.traffic?.capGB ? r.traffic.capGB * 0.95 : '–'} GB</b></div></div>
<p class="muted">Measured by the game server (everything it sends). Render's own number: dashboard.render.com → Workspace → Billing / Usage.</p>
<h2>Players</h2><div class="cards"><div class="card">Online now<b class="live">${r.online}</b></div><div class="card">Visitors (all time)<b>${visitors.length}</b></div>
<div class="card">Sessions<b>${totalVisits}</b></div><div class="card">Total play time<b>${dur(totalSeconds)}</b></div>
<div class="card">Avg session<b>${totalVisits ? dur(Math.round(totalSeconds / totalVisits)) : '–'}</b></div></div>
<h2>By day</h2><table><tr><th>Day</th><th>Visitors</th><th>Sessions</th><th>Play time</th></tr>
${days.map(([d, v]) => `<tr><td>${d}</td><td>${v.visitors.length}</td><td>${v.sessions}</td><td>${dur(v.seconds)}</td></tr>`).join('')}</table>
<h2>Visitors</h2><table><tr><th>Visitor</th><th>First seen</th><th>Last seen</th><th>Sessions</th><th>Total time</th><th>Device</th><th>Favourite hero</th></tr>
${visitors.slice(0, 300).map(([id, v]) => `<tr><td>${esc(id.slice(0, 10))}</td><td>${time(v.first)}</td><td>${time(v.last)}</td><td>${v.visits}</td><td>${dur(v.seconds)}</td><td>${esc(v.device)}</td><td>${esc(fav(v.heroes))}</td></tr>`).join('')}</table>
<h2>Sessions (enter → leave)</h2><table><tr><th>Entered</th><th>Left</th><th>Visitor</th><th>Hero</th><th>Mode</th><th>Device</th><th>Time</th></tr>
${[...r.sessions].reverse().slice(0, 300).map(s => `<tr><td>${time(s.start)}</td><td>${s.live ? '<span class="live">playing</span>' : time(s.end)}</td><td>${esc(s.visitor.slice(0, 10))}</td><td>${esc(s.hero || '')}</td><td>${esc(s.mode)}</td><td>${esc(s.device)}</td><td>${dur(s.seconds)}</td></tr>`).join('')}</table>
</body></html>`;
}

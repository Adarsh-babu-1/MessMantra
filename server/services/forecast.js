import db, { must } from '../db.js';

let cache = { at: 0, value: null };

// Head-count forecast, cached in memory for about 5 seconds so dashboard refreshes do not hit the database every time.
export async function forecast(now = Date.now()) {
  if (cache.value && now - cache.at < 5000) return cache.value;
  const rows = must(await db.rpc('forecast_meals', { p_since: now - 24 * 3600 * 1000 }));
  const value = rows.map((r) => ({
    id: r.id, type: r.type, menu: r.menu, cutoffAt: r.cutoff_at, serveStart: r.serve_start,
    serveEnd: r.serve_end, projected: Number(r.projected), consumed: Number(r.consumed),
  }));
  cache = { at: now, value };
  return value;
}

// Called after the admin adds or edits a meal so the dashboard updates at once.
export function resetForecast() { cache = { at: 0, value: null }; }

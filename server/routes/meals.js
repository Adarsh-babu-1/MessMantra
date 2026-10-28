import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import db, { must } from '../db.js';
import { auth, role } from '../middleware/auth.js';
import { wrap } from '../middleware/wrap.js';
import { mealState } from '../services/cutoff.js';
import { issueToken, toImage } from '../services/qr.js';

const r = Router();
r.use(auth);

const qrLimit = rateLimit({
  windowMs: 60 * 1000, limit: 20, keyGenerator: (req) => 'u' + req.user.id,
  skip: () => process.env.NODE_ENV === 'test', message: { error: 'Too many QR refreshes, wait a moment' },
});
const mealId = (req) => (/^\d{1,12}$/.test(req.params.id) ? Number(req.params.id) : NaN);

// Meals for one day (?from=&to= are the browser's local-day start and end in ms), with the user's own status.
// Without from/to it returns upcoming meals. serverTime lets the page draw a correct countdown.
r.get('/', wrap(async (req, res) => {
  const now = Date.now();
  const from = Number(req.query.from), to = Number(req.query.to);
  let q = db.from('meals').select('*').order('serve_start');
  if (Number.isSafeInteger(from) && Number.isSafeInteger(to) && to > from && to - from <= 3 * 86400000)
    q = q.gte('serve_start', from).lt('serve_start', to);
  else q = q.gt('serve_end', now - 3600 * 1000);
  const meals = must(await q);
  const ids = meals.map((m) => m.id);
  const [opts, eaten] = ids.length ? await Promise.all([
    db.from('optins').select('meal_id,status').eq('user_id', req.user.id).in('meal_id', ids).then(must),
    db.from('ledger').select('meal_id').eq('user_id', req.user.id).in('meal_id', ids).then(must),
  ]) : [[], []];
  const status = Object.fromEntries(opts.map((o) => [o.meal_id, o.status]));
  const ate = new Set(eaten.map((l) => l.meal_id));
  res.json({
    serverTime: now,
    meals: meals.map((m) => ({
      id: m.id, type: m.type, menu: m.menu, cutoffAt: m.cutoff_at, serveStart: m.serve_start, serveEnd: m.serve_end,
      status: status[m.id] || 'none', eaten: ate.has(m.id), state: mealState(m, now),
    })),
  });
}));

// The student's eating history: every meal that was scanned for them, newest first.
r.get('/history', role('student'), wrap(async (req, res) => {
  const rows = must(await db.from('ledger').select('scanned_at, meals(type, menu)')
    .eq('user_id', req.user.id).order('scanned_at', { ascending: false }).limit(300));
  res.json({ rows: rows.map((x) => ({ at: x.scanned_at, type: x.meals?.type, menu: x.meals?.menu })) });
}));

// Opt in / cancel. The cutoff check lives INSIDE the SQL function set_optin, so it cannot be bypassed.
function setStatus(status) {
  return wrap(async (req, res) => {
    const id = mealId(req);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad meal id' });
    const out = must(await db.rpc('set_optin', { p_user: req.user.id, p_meal: id, p_status: status, p_now: Date.now() }));
    if (out === 'not_found') return res.status(404).json({ error: 'Meal not found' });
    if (out === 'cutoff') return res.status(403).json({ error: 'Cutoff passed, no more changes for this meal' });
    res.json({ ok: true, status });
  });
}
r.post('/:id/optin', role('student'), setStatus('opted_in'));
r.post('/:id/cancel', role('student'), setStatus('cancelled'));

// QR for an opted-in meal. The page asks for a fresh one every 30 s.
r.get('/:id/qr', role('student'), qrLimit, wrap(async (req, res) => {
  const id = mealId(req);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad meal id' });
  const out = await issueToken(req.user.id, id);
  if (out.error) return res.status(out.code).json({ error: out.error });
  res.json({ token: out.token, expiresAt: out.expiresAt, image: await toImage(out.token) });
}));

export default r;

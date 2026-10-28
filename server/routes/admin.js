import { Router } from 'express';
import db, { must } from '../db.js';
import { auth, role } from '../middleware/auth.js';
import { wrap } from '../middleware/wrap.js';
import { audit } from '../services/audit.js';
import { resetForecast } from '../services/forecast.js';

const r = Router();
r.use(auth, role('admin'));

const TYPES = ['breakfast', 'lunch', 'snacks', 'dinner'];
function parseMeal(b = {}) {
  const { type, menu, cutoffAt, serveStart, serveEnd } = b;
  if (!TYPES.includes(type)) return { error: 'Choose breakfast, lunch, snacks or dinner' };
  if (typeof menu !== 'string' || menu.trim().length < 3 || menu.length > 300) return { error: 'Menu must be 3 to 300 characters' };
  if (![cutoffAt, serveStart, serveEnd].every(Number.isSafeInteger)) return { error: 'Enter valid times' };
  if (!(cutoffAt <= serveStart && serveStart < serveEnd)) return { error: 'Order must be: cutoff, serving start, serving end' };
  return { value: { type, menu: menu.trim(), cutoff_at: cutoffAt, serve_start: serveStart, serve_end: serveEnd } };
}

r.post('/meals', wrap(async (req, res) => {
  const p = parseMeal(req.body);
  if (p.error) return res.status(400).json({ error: p.error });
  const row = must(await db.from('meals').insert({ ...p.value, created_at: Date.now() }).select('id').single());
  await audit(req.user.id, 'meal_created', `${p.value.type}: ${p.value.menu.slice(0, 60)}`);
  resetForecast();
  res.status(201).json({ id: row.id });
}));

// Edit an existing meal (menu or times). Logged in the audit trail.
r.put('/meals/:id', wrap(async (req, res) => {
  if (!/^\d{1,12}$/.test(req.params.id)) return res.status(400).json({ error: 'Bad meal id' });
  const p = parseMeal(req.body);
  if (p.error) return res.status(400).json({ error: p.error });
  const row = must(await db.from('meals').update(p.value).eq('id', Number(req.params.id)).select('id').maybeSingle());
  if (!row) return res.status(404).json({ error: 'Meal not found' });
  await audit(req.user.id, 'meal_updated', `${p.value.type}: ${p.value.menu.slice(0, 60)}`);
  resetForecast();
  res.json({ ok: true });
}));

r.get('/ledger', wrap(async (req, res) => {
  const rows = must(await db.rpc('admin_ledger'));
  res.json({ rows: rows.map((x) => ({ at: x.scanned_at, student: x.student, meal: x.meal, menu: x.menu, staff: x.staff })) });
}));

r.get('/audit', wrap(async (req, res) => {
  const rows = must(await db.rpc('admin_audit'));
  res.json({ rows: rows.map((x) => ({ at: x.created_at, actor: x.actor, action: x.action, details: x.details })) });
}));

export default r;

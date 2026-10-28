import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { must } from '../db.js';
import { signToken } from '../middleware/auth.js';
import { wrap } from '../middleware/wrap.js';
import { audit } from '../services/audit.js';

const r = Router();
const DUMMY = bcrypt.hashSync('not-a-real-password', 10); // keeps timing similar for unknown emails
const emailOk = (e) => typeof e === 'string' && e.length <= 120 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

r.post('/register', wrap(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 60) return res.status(400).json({ error: 'Enter your name' });
  if (!emailOk(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Password must be 8 to 72 characters' });
  const { data, error } = await db.from('users')
    .insert({ name: name.trim(), email: email.toLowerCase(), password_hash: bcrypt.hashSync(password, 10), role: 'student', created_at: Date.now() })
    .select('id').single();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    throw error;
  }
  const user = { id: data.id, name: name.trim(), role: 'student' };
  await audit(user.id, 'register', email.toLowerCase());
  res.status(201).json({ token: signToken(user), user });
}));

r.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const u = typeof email === 'string'
    ? must(await db.from('users').select('*').eq('email', email.toLowerCase()).maybeSingle()) : null;
  const ok = bcrypt.compareSync(typeof password === 'string' ? password : '', u ? u.password_hash : DUMMY);
  if (!u || !ok) { await audit(null, 'login_failed', String(email).slice(0, 80)); return res.status(401).json({ error: 'Wrong email or password' }); }
  await audit(u.id, 'login', u.role);
  res.json({ token: signToken(u), user: { id: u.id, name: u.name, role: u.role } });
}));

export default r;

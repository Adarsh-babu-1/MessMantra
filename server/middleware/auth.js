import jwt from 'jsonwebtoken';
import config from '../config.js';

export function auth(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Please login' });
  try {
    const p = jwt.verify(h.slice(7), config.jwtSecret, { algorithms: ['HS256'] });
    req.user = { id: Number(p.sub), role: p.role, name: p.name };
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please login again' });
  }
}

export const role = (...allowed) => (req, res, next) =>
  allowed.includes(req.user.role) ? next() : res.status(403).json({ error: 'Not allowed for your role' });

export const signToken = (u) =>
  jwt.sign({ role: u.role, name: u.name }, config.jwtSecret, { subject: String(u.id), expiresIn: '8h', algorithm: 'HS256' });

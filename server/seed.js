import bcrypt from 'bcryptjs';
import db, { must } from './db.js';

const now = Date.now();
const min = 60 * 1000;
const users = [
  ['Admin', 'admin@mess.com', 'admin12345', 'admin'],
  ['Kitchen Staff', 'staff@mess.com', 'staff12345', 'staff'],
  ['Riya Student', 'student@mess.com', 'student12345', 'student'],
].map(([name, email, pw, role]) => ({ name, email, password_hash: bcrypt.hashSync(pw, 10), role, created_at: now }));

must(await db.from('users').upsert(users, { onConflict: 'email', ignoreDuplicates: true }));

// Demo meals: lunch locks in 2 min and is served from minute 3, dinner is later.
must(await db.from('meals').insert([
  { type: 'lunch', menu: 'Rajma, jeera rice, roti, salad', cutoff_at: now + 2 * min, serve_start: now + 3 * min, serve_end: now + 120 * min, created_at: now },
  { type: 'dinner', menu: 'Paneer butter masala, naan, kheer', cutoff_at: now + 240 * min, serve_start: now + 360 * min, serve_end: now + 480 * min, created_at: now },
]));
console.log('Seeded. Logins: admin@mess.com / admin12345, staff@mess.com / staff12345, student@mess.com / student12345');

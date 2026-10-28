// Integration tests against a real Supabase project (use a separate TEST project, they insert rows).
// Needs .env filled and supabase/schema.sql already run.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

let app, db;
const tokens = {};
const ids = {};
const A = (t) => ({ Authorization: 'Bearer ' + t });
const must = ({ data, error }) => { if (error) throw error; return data; };

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  app = (await import('../server/app.js')).default;
  db = (await import('../server/db.js')).default;
  const bcrypt = (await import('bcryptjs')).default;
  const hash = bcrypt.hashSync('password123', 4);
  const run = Date.now();
  for (const [name, role] of [['admin', 'admin'], ['staff', 'staff'], ['stu', 'student'], ['stu2', 'student']]) {
    const email = `${name}${run}@t.com`;
    ids[name] = must(await db.from('users').insert({ name, email, password_hash: hash, role, created_at: Date.now() }).select('id').single()).id;
    const r = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
    tokens[name] = r.body.token;
  }
}, 30000);

const newMeal = async (cutoff, start, end) => {
  const n = Date.now();
  return must(await db.from('meals').insert({ type: 'lunch', menu: 'Dal rice', cutoff_at: n + cutoff, serve_start: n + start, serve_end: n + end, created_at: n }).select('id').single()).id;
};

describe('roles and login', () => {
  it('rejects a wrong password', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'nobody@t.com', password: 'nope-nope' });
    expect(r.status).toBe(401);
  });
  it('blocks a student from the admin API', async () => {
    expect((await request(app).post('/api/admin/meals').set(A(tokens.stu)).send({})).status).toBe(403);
  });
});

describe('cutoff engine', () => {
  it('allows opt-in before cutoff and rejects after it', async () => {
    const open = await newMeal(60000, 120000, 3600000);
    const closed = await newMeal(-1000, 1000, 3600000);
    expect((await request(app).post(`/api/meals/${open}/optin`).set(A(tokens.stu))).status).toBe(200);
    expect((await request(app).post(`/api/meals/${open}/cancel`).set(A(tokens.stu))).status).toBe(200);
    const late = await request(app).post(`/api/meals/${closed}/optin`).set(A(tokens.stu));
    expect(late.status).toBe(403);
    expect(late.body.error).toMatch(/cutoff/i);
  });
});

describe('QR check-in', () => {
  it('needs an opt-in before a QR is issued', async () => {
    const m = await newMeal(-1000, -500, 3600000);
    expect((await request(app).get(`/api/meals/${m}/qr`).set(A(tokens.stu2))).status).toBe(403);
  });
  it('rejects tampered codes', async () => {
    const r = await request(app).post('/api/scan').set(A(tokens.staff)).send({ token: 'abc.def' });
    expect(r.body.ok).toBe(false);
  });
  it('lets exactly one of many simultaneous scans succeed', async () => {
    const m = await newMeal(-1000, -500, 3600000); // already serving
    must(await db.from('optins').insert({ user_id: ids.stu, meal_id: m, status: 'opted_in', updated_at: Date.now() }));
    const q = await request(app).get(`/api/meals/${m}/qr`).set(A(tokens.stu));
    expect(q.status).toBe(200);
    const scans = await Promise.all(Array.from({ length: 10 }, () =>
      request(app).post('/api/scan').set(A(tokens.staff)).send({ token: q.body.token })));
    expect(scans.filter((s) => s.body.ok).length).toBe(1);
    const rows = must(await db.from('ledger').select('id').eq('user_id', ids.stu).eq('meal_id', m));
    expect(rows.length).toBe(1);
  }, 30000);
});

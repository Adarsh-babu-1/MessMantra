import crypto from 'node:crypto';
import QRCode from 'qrcode';
import db, { must } from '../db.js';
import config from '../config.js';
import { audit } from './audit.js';

const sign = (payload) => crypto.createHmac('sha256', config.qrSecret).update(payload).digest('hex');
const fail = (reason) => ({ ok: false, reason });

// Token = base64url(JSON{u,m,n,e}) + "." + HMAC-SHA256 signature
export async function issueToken(userId, mealId, now = Date.now()) {
  const nonce = crypto.randomBytes(12).toString('hex');
  const expiresAt = now + config.qrTtlMs;
  const r = must(await db.rpc('issue_qr', { p_user: userId, p_meal: mealId, p_nonce: nonce, p_exp: expiresAt, p_now: now }));
  if (!r.ok) return { error: r.error, code: r.code };
  const payload = Buffer.from(JSON.stringify({ u: userId, m: mealId, n: nonce, e: expiresAt })).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export const toImage = (token) => QRCode.toDataURL(token, { margin: 1, width: 300, errorCorrectionLevel: 'M' });

function verify(token) {
  if (typeof token !== 'string' || token.length > 600) return null;
  const [payload, sig] = token.trim().split('.');
  if (!payload || !sig) return null;
  const good = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (good.length !== given.length || !crypto.timingSafeEqual(good, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return Number.isInteger(p.u) && Number.isInteger(p.m) && typeof p.n === 'string' ? p : null;
  } catch { return null; }
}

export async function redeem(token, staffId, now = Date.now()) {
  const p = verify(token);
  if (!p) { await audit(staffId, 'scan_rejected', 'invalid signature'); return fail('Invalid or tampered QR'); }
  if (p.e <= now) { await audit(staffId, 'scan_rejected', 'expired'); return fail('QR expired, ask the student to refresh'); }
  // The database function runs as ONE transaction: token update + ledger insert + audit.
  const r = must(await db.rpc('redeem_qr', { p_user: p.u, p_meal: p.m, p_nonce: p.n, p_staff: staffId, p_now: now }));
  if (!r.ok) await audit(staffId, 'scan_rejected', r.reason);
  return r;
}

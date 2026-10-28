import dotenv from 'dotenv';
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
function secret(name, devDefault) {
  const v = process.env[name];
  if (v) return v;
  if (isProd) throw new Error(`${name} must be set in production`);
  if (process.env.NODE_ENV !== 'test') console.warn(`[warn] ${name} not set, using an insecure dev default`);
  return devDefault;
}
function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing. Copy .env.example to .env and fill it (Supabase dashboard -> Project Settings -> API).`);
  return v;
}

export default {
  port: Number(process.env.PORT) || 3000,
  supabaseUrl: required('SUPABASE_URL'),
  supabaseKey: required('SUPABASE_SERVICE_KEY'),
  jwtSecret: secret('JWT_SECRET', 'dev-jwt-secret-change-me'),
  qrSecret: secret('QR_SECRET', 'dev-qr-secret-change-me'),
  qrTtlMs: 60 * 1000, // each QR token lives about 60 s, the page refreshes it every 30 s
};

import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import mealRoutes from './routes/meals.js';
import staffRoutes from './routes/staff.js';
import adminRoutes from './routes/admin.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // behind the Render/Railway proxy
app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: { 'upgrade-insecure-requests': null } } }));
app.use(express.json({ limit: '10kb' }));

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 50, skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many attempts, try again later' },
});
app.use('/api/auth', authLimit, authRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', staffRoutes); // POST /api/scan, GET /api/forecast
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use('/vendor', express.static(path.join(root, 'node_modules/html5-qrcode')));
app.use(express.static(path.join(root, 'public')));

app.use((err, req, res, next) => { // a bad request must never crash the server
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad JSON' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

export default app;

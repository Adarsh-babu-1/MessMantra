import { Router } from 'express';
import { auth, role } from '../middleware/auth.js';
import { wrap } from '../middleware/wrap.js';
import { redeem } from '../services/qr.js';
import { forecast } from '../services/forecast.js';

const r = Router();
r.use(auth, role('staff', 'admin'));

r.post('/scan', wrap(async (req, res) => res.json(await redeem((req.body || {}).token, req.user.id))));
r.get('/forecast', wrap(async (req, res) => res.json({ meals: await forecast() })));

export default r;

import db from '../db.js';

export async function audit(actorId, action, details = '') {
  const { error } = await db.from('audit').insert({
    actor_id: actorId ?? null, action, details: String(details).slice(0, 300), created_at: Date.now(),
  });
  if (error) console.error('audit failed:', error.message);
}

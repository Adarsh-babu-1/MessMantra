import { createClient } from '@supabase/supabase-js';
import config from './config.js';

// Server-side client using the service_role key (bypasses RLS). It never reaches the browser.
const db = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Unwrap a Supabase response: return data or throw the error.
export function must({ data, error }) {
  if (error) throw error;
  return data;
}

export default db;

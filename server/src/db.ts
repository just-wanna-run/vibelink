import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://oqpqyrygvrildbjjbqlf.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || '';

let supabase: SupabaseClient;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[DB] Supabase connected');
  }
  return supabase;
}

// Export for direct use (replaces sql.js getDb)
function getDb() {
  return getSupabase();
}

export { getDb };

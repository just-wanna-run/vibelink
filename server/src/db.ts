import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://oqpqyrygvrildbjjbqlf.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || '';

let supabase: SupabaseClient;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    if (!supabaseKey) {
      console.error('[DB] SUPABASE_KEY is not set!');
    }
    console.log('[DB] Connecting to Supabase:', supabaseUrl, 'key length:', supabaseKey.length);
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[DB] Supabase client created');
  }
  return supabase;
}

// Export for direct use (replaces sql.js getDb)
function getDb() {
  return getSupabase();
}

export { getDb };

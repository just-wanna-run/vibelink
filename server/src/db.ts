const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

let _db: any = null;

export function getDb(): any {
  if (!_db) {
    const { createClient } = require('@supabase/supabase-js');
    _db = createClient(supabaseUrl, supabaseKey);
  }
  return _db;
}

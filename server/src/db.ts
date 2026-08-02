import initSqlJs, { Database as SqlJsDatabase, Statement as SqlJsStatement } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'data', 'vibelink.db');

// ---- Database wrapper that mimics better-sqlite3 API over sql.js ----

class StatementWrapper {
  constructor(
    private stmt: SqlJsStatement,
    private db: SqlJsDatabase,
  ) {}

  get(...params: any[]): any {
    this.stmt.bind(params);
    if (this.stmt.step()) {
      const obj = this.stmt.getAsObject();
      this.stmt.reset();
      return obj;
    }
    this.stmt.reset();
    return undefined;
  }

  all(...params: any[]): any[] {
    this.stmt.bind(params);
    const rows: any[] = [];
    while (this.stmt.step()) {
      rows.push(this.stmt.getAsObject());
    }
    this.stmt.reset();
    return rows;
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    this.stmt.bind(params);
    this.stmt.step();
    this.stmt.reset();
    // sql.js doesn't expose changes/lastInsertRowid easily, approximate
    const lastId = (this.db as any).lastInsertRowId || 0;
    return { changes: 1, lastInsertRowid: lastId };
  }
}

class DbWrapper {
  private db: SqlJsDatabase;

  constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  prepare(sql: string): StatementWrapper {
    const stmt = this.db.prepare(sql);
    return new StatementWrapper(stmt, this.db);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  // Save database to disk
  save(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, buffer);
  }

  close(): void {
    this.save();
    this.db.close();
  }

  // Get raw sql.js db for direct operations if needed
  getRawDb(): SqlJsDatabase {
    return this.db;
  }
}

// ---- Initialize ----

let db: DbWrapper;

async function initDb(): Promise<DbWrapper> {
  const SQL = await initSqlJs();

  let sqlDb: SqlJsDatabase;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(buffer);
    console.log('[DB] Loaded existing database from disk');
  } else {
    sqlDb = new SQL.Database();
    console.log('[DB] Created new database');
  }

  // Create tables (IF NOT EXISTS handles existing dbs safely)
  sqlDb.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    public_key TEXT,
    encrypted_private_key TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  )`);

  sqlDb.run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    device_name TEXT DEFAULT 'Unknown',
    device_type TEXT DEFAULT 'unknown',
    expires_at INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  )`);

  sqlDb.run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_device TEXT,
    type TEXT NOT NULL DEFAULT 'text',
    content TEXT,
    file_name TEXT,
    file_size INTEGER,
    file_type TEXT,
    file_path TEXT,
    encrypted_key TEXT,
    iv TEXT,
    client_message_id TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  )`);

  // Feedback table
  sqlDb.run(`CREATE TABLE IF NOT EXISTS feedbacks (
    id TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    contact TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  )`);

  // Create indexes (IF NOT EXISTS not supported in older SQLite; use try-catch style)
  try { sqlDb.run('CREATE INDEX idx_messages_user_time ON messages(user_id, created_at DESC)'); } catch {}
  try { sqlDb.run('CREATE INDEX idx_messages_client_id ON messages(client_message_id)'); } catch {}
  try { sqlDb.run('CREATE INDEX idx_sessions_user ON sessions(user_id)'); } catch {}
  try { sqlDb.run('CREATE INDEX idx_sessions_token ON sessions(token)'); } catch {}

  db = new DbWrapper(sqlDb);
  db.save();
  console.log('[DB] Database ready');
  return db;
}

// Save helper — call after any write operation
function saveDb() {
  if (db) db.save();
}

// Export a promise that resolves when DB is ready
const dbReady = initDb();

// Synchronous accessor — safe after dbReady resolves
function getDb(): DbWrapper {
  if (!db) throw new Error('Database not initialized. Wait for dbReady first.');
  return db;
}

export { dbReady, getDb, saveDb, DbWrapper };
export default dbReady;

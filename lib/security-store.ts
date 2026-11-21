import type { Database } from './database.ts';

const ready = new WeakMap<Database, Promise<void>>();
export function ensureSecurityTables(db: Database): Promise<void> {
  let pending = ready.get(db);
  if (!pending) {
    pending = (async () => {
      await db.prepare('CREATE TABLE IF NOT EXISTS active_sessions (id_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)').run();
      await db.prepare('CREATE TABLE IF NOT EXISTS market_limits (provider TEXT PRIMARY KEY, window_id INTEGER NOT NULL, count INTEGER NOT NULL)').run();
    })().catch(error => {ready.delete(db); throw error;});
    ready.set(db, pending);
  }
  return pending;
}

export async function reserveMarketCredits(db: Database, provider: string, cost: number, limit: number, now = Date.now()) {
  if (!Number.isInteger(cost) || cost <= 0 || !Number.isInteger(limit) || limit <= 0) throw new Error('Invalid market-data quota.');
  await ensureSecurityTables(db);
  const row = await db.prepare('INSERT INTO market_limits(provider,window_id,count) VALUES (?,?,?) ON CONFLICT(provider) DO UPDATE SET window_id=excluded.window_id,count=CASE WHEN market_limits.window_id=excluded.window_id THEN MIN(market_limits.count+excluded.count,?) ELSE excluded.count END RETURNING count')
    .bind(provider, Math.floor(now / 60000), cost, limit + 1).first<{count: number}>();
  if (!row) throw new Error('Shared market-data quota unavailable.');
  return row.count <= limit;
}

import { getAccountDatabase, type Database } from './database.ts';
import { ensureSecurityTables } from './security-store.ts';
import { signSession, sessionClaims, type SessionUser } from './session.ts';

const hash = async (value: string) => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex');

export async function createActiveSession(user: SessionUser, secret: string, db: Database | undefined = getAccountDatabase(), now = Date.now()) {
  if (!db) throw new Error('Session database unavailable.');
  await ensureSecurityTables(db);
  const token = await signSession(user, secret, now);
  const claims = await sessionClaims(token, secret, now);
  if (!claims) throw new Error('Session creation failed.');
  await db.prepare('DELETE FROM active_sessions WHERE expires_at<=?').bind(Math.floor(now / 1000)).run();
  await db.prepare('INSERT INTO active_sessions(id_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hash(claims.sessionId), user.userId, claims.expires).run();
  return token;
}

export async function activeSession(token: string | undefined, secret: string | undefined, db: Database | undefined = getAccountDatabase(), now = Date.now()): Promise<SessionUser | null> {
  const claims = await sessionClaims(token, secret, now);
  if (!claims || !db) return null;
  try {
    const row = await db.prepare('SELECT user_id,expires_at FROM active_sessions WHERE id_hash=?').bind(await hash(claims.sessionId)).first<{user_id: string; expires_at: number}>();
    return row?.user_id === claims.user.userId && row.expires_at > now / 1000 ? claims.user : null;
  } catch {return null;}
}

export async function revokeSession(token: string | undefined, secret: string | undefined, db: Database | undefined = getAccountDatabase(), now = Date.now()) {
  const claims = await sessionClaims(token, secret, now);
  if (!claims) return;
  if (!db) throw new Error('Session database unavailable.');
  await ensureSecurityTables(db);
  await db.prepare('DELETE FROM active_sessions WHERE id_hash=? AND user_id=?').bind(await hash(claims.sessionId), claims.user.userId).run();
}

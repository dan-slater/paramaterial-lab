/**
 * Password hashing + session management.
 *
 * - Argon2id via @node-rs/argon2 (small, pure Rust).
 * - Sessions are random 256-bit IDs stored in SQLite. Cookie holds the raw id;
 *   server-side we only compare by equality, so no HMAC is needed.
 * - 30-day expiry with rolling refresh on every successful lookup.
 */
import { hash, verify } from '@node-rs/argon2';
import { db, newId } from './db';
import { DISPLAY_NAME_MAX, EMAIL_MAX, PASSWORD_MAX, PASSWORD_MIN } from './config';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000; // refresh if < 24h remaining? (actually we extend anytime)
export const SESSION_COOKIE = 'paramaterial_sess';

export interface SessionUser {
	id: string;
	email: string;
	displayName: string;
}

export async function hashPassword(password: string): Promise<string> {
	// Default algorithm is Argon2id; using default params keeps us free of the
	// Algorithm const-enum import (which conflicts with verbatimModuleSyntax).
	return hash(password, {
		memoryCost: 19456,
		timeCost: 2,
		parallelism: 1
	});
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
	try {
		return await verify(passwordHash, password);
	} catch {
		return false;
	}
}

export function createSession(userId: string): { id: string; expiresAt: number } {
	const id = randomToken();
	const expiresAt = Date.now() + SESSION_TTL_MS;
	db()
		.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
		.run(id, userId, expiresAt);
	return { id, expiresAt };
}

export function getSessionUser(sessionId: string | undefined): SessionUser | null {
	if (!sessionId) return null;
	const row = db()
		.prepare(
			`SELECT s.id AS sid, s.expires_at AS expires_at, u.id AS uid, u.email AS email, u.display_name AS display_name
			 FROM sessions s JOIN users u ON u.id = s.user_id
			 WHERE s.id = ?`
		)
		.get(sessionId) as
		| { sid: string; expires_at: number; uid: string; email: string; display_name: string }
		| undefined;
	if (!row) return null;
	if (row.expires_at < Date.now()) {
		db().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
		return null;
	}
	// Rolling refresh: bump expiry if the session is more than 24h old (i.e. has
	// less than TTL - 24h remaining). Keeps writes rare but keeps active users
	// signed in indefinitely.
	const remaining = row.expires_at - Date.now();
	if (remaining < SESSION_TTL_MS - REFRESH_WINDOW_MS) {
		db()
			.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
			.run(Date.now() + SESSION_TTL_MS, sessionId);
	}
	return { id: row.uid, email: row.email, displayName: row.display_name };
}

export function destroySession(sessionId: string | undefined): void {
	if (!sessionId) return;
	db().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export async function createUser(
	email: string,
	password: string,
	displayName: string
): Promise<{ id: string } | { error: 'email_taken' | 'invalid' }> {
	const normEmail = email.trim().toLowerCase();
	if (
		!normEmail ||
		normEmail.length > EMAIL_MAX ||
		!/^[^\s@]+@[^\s@]+$/.test(normEmail) ||
		password.length < PASSWORD_MIN ||
		password.length > PASSWORD_MAX ||
		!displayName.trim() ||
		displayName.trim().length > DISPLAY_NAME_MAX
	) {
		return { error: 'invalid' };
	}
	const existing = db().prepare('SELECT id FROM users WHERE email = ?').get(normEmail);
	if (existing) return { error: 'email_taken' };
	const id = newId();
	const pwHash = await hashPassword(password);
	db()
		.prepare(
			'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)'
		)
		.run(id, normEmail, pwHash, displayName.trim(), Date.now());
	return { id };
}

export async function authenticate(
	email: string,
	password: string
): Promise<{ id: string; email: string; displayName: string } | null> {
	const normEmail = email.trim().toLowerCase();
	const row = db()
		.prepare('SELECT id, email, display_name, password_hash FROM users WHERE email = ?')
		.get(normEmail) as
		| { id: string; email: string; display_name: string; password_hash: string }
		| undefined;
	if (!row) {
		// Spend the same argon2 time as a real check so response timing does not
		// reveal which emails have accounts.
		await verifyPassword(await dummyHash(), password);
		return null;
	}
	const ok = await verifyPassword(row.password_hash, password);
	if (!ok) return null;
	return { id: row.id, email: row.email, displayName: row.display_name };
}

let _dummy: Promise<string> | null = null;
function dummyHash(): Promise<string> {
	_dummy ??= hashPassword(randomToken());
	return _dummy;
}

function randomToken(): string {
	const buf = new Uint8Array(32);
	crypto.getRandomValues(buf);
	return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const SESSION_TTL = SESSION_TTL_MS;

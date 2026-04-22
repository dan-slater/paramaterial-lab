/**
 * SQLite database handle (single process-wide instance).
 *
 * Opens `process.env.DB_PATH ?? './paramaterial.db'` on first import. Creates
 * the schema if missing. Uses WAL for better concurrent reads.
 *
 * Kept intentionally raw-SQL — no ORM. We'll migrate to Postgres later.
 */
import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH ?? './paramaterial.db';

let _db: Database.Database | null = null;

function init(db: Database.Database) {
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			display_name TEXT NOT NULL,
			created_at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS projects (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			owner_id TEXT NOT NULL REFERENCES users(id),
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS project_members (
			project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			role TEXT NOT NULL CHECK (role IN ('owner','editor','viewer')),
			added_at INTEGER NOT NULL,
			PRIMARY KEY (project_id, user_id)
		);
		CREATE TABLE IF NOT EXISTS reports (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			blocks_json TEXT NOT NULL,
			chat_json TEXT NOT NULL DEFAULT '{"v":1,"messages":[]}',
			dataset_ref TEXT,
			created_by TEXT NOT NULL REFERENCES users(id),
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_reports_project ON reports(project_id);
		CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
	`);
}

export function db(): Database.Database {
	if (_db) return _db;
	_db = new Database(DB_PATH);
	init(_db);
	return _db;
}

export function newId(): string {
	// crypto.randomUUID is built-in; compact enough for our purposes.
	return crypto.randomUUID();
}

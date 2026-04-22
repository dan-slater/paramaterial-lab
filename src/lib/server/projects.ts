/**
 * Project + report data access helpers.
 *
 * Keep SQL inline and authorization checks close to the call site.
 * Membership roles: owner > editor > viewer.
 */
import { db, newId } from './db';

export type Role = 'owner' | 'editor' | 'viewer';

export interface ProjectRow {
	id: string;
	name: string;
	description: string | null;
	owner_id: string;
	created_at: number;
	updated_at: number;
}

export interface ReportRow {
	id: string;
	project_id: string;
	name: string;
	blocks_json: string;
	chat_json: string;
	dataset_ref: string | null;
	created_by: string;
	created_at: number;
	updated_at: number;
}

export interface MemberRow {
	user_id: string;
	email: string;
	display_name: string;
	role: Role;
	added_at: number;
}

export const EMPTY_BLOCKS_JSON = JSON.stringify({
	v: 1,
	blocks: [
		{
			id: 'init-dataset',
			type: 'dataset-picker',
			config: {},
			createdAt: Date.now()
		}
	]
});
export const EMPTY_CHAT_JSON = JSON.stringify({ v: 1, messages: [] });

export function getRole(projectId: string, userId: string): Role | null {
	const row = db()
		.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
		.get(projectId, userId) as { role: Role } | undefined;
	return row?.role ?? null;
}

export function requireRole(
	projectId: string,
	userId: string,
	atLeast: Role
): Role | null {
	const role = getRole(projectId, userId);
	if (!role) return null;
	const rank: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };
	if (rank[role] < rank[atLeast]) return null;
	return role;
}

export function listProjectsForUser(userId: string) {
	const rows = db()
		.prepare(
			`SELECT p.id, p.name, p.description, p.updated_at, pm.role,
			        (SELECT COUNT(*) FROM reports r WHERE r.project_id = p.id) AS report_count
			 FROM projects p
			 JOIN project_members pm ON pm.project_id = p.id
			 WHERE pm.user_id = ?
			 ORDER BY p.updated_at DESC`
		)
		.all(userId) as Array<{
		id: string;
		name: string;
		description: string | null;
		updated_at: number;
		role: Role;
		report_count: number;
	}>;
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		description: r.description,
		role: r.role,
		reportCount: r.report_count,
		updatedAt: r.updated_at
	}));
}

export function createProject(ownerId: string, name: string, description: string | null) {
	const id = newId();
	const now = Date.now();
	const tx = db().transaction(() => {
		db()
			.prepare(
				'INSERT INTO projects (id, name, description, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.run(id, name, description, ownerId, now, now);
		db()
			.prepare(
				'INSERT INTO project_members (project_id, user_id, role, added_at) VALUES (?, ?, ?, ?)'
			)
			.run(id, ownerId, 'owner', now);
	});
	tx();
	return { id, name, description, ownerId, createdAt: now, updatedAt: now };
}

export function getProject(projectId: string): ProjectRow | null {
	const row = db().prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as
		| ProjectRow
		| undefined;
	return row ?? null;
}

export function listMembers(projectId: string): MemberRow[] {
	return db()
		.prepare(
			`SELECT pm.user_id, u.email, u.display_name, pm.role, pm.added_at
			 FROM project_members pm JOIN users u ON u.id = pm.user_id
			 WHERE pm.project_id = ?
			 ORDER BY CASE pm.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, u.display_name`
		)
		.all(projectId) as MemberRow[];
}

export function addMemberByEmail(
	projectId: string,
	email: string,
	role: Role
): { ok: true; userId: string } | { ok: false; error: 'not_found' | 'exists' | 'invalid_role' } {
	if (role !== 'owner' && role !== 'editor' && role !== 'viewer') {
		return { ok: false, error: 'invalid_role' };
	}
	const user = db()
		.prepare('SELECT id FROM users WHERE email = ?')
		.get(email.trim().toLowerCase()) as { id: string } | undefined;
	if (!user) return { ok: false, error: 'not_found' };
	const existing = db()
		.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
		.get(projectId, user.id);
	if (existing) return { ok: false, error: 'exists' };
	db()
		.prepare('INSERT INTO project_members (project_id, user_id, role, added_at) VALUES (?, ?, ?, ?)')
		.run(projectId, user.id, role, Date.now());
	return { ok: true, userId: user.id };
}

export function removeMember(projectId: string, userId: string) {
	db()
		.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?')
		.run(projectId, userId);
}

export function updateProject(
	projectId: string,
	patch: { name?: string; description?: string | null }
) {
	const fields: string[] = [];
	const values: unknown[] = [];
	if (typeof patch.name === 'string') {
		fields.push('name = ?');
		values.push(patch.name);
	}
	if (patch.description !== undefined) {
		fields.push('description = ?');
		values.push(patch.description);
	}
	if (!fields.length) return;
	fields.push('updated_at = ?');
	values.push(Date.now());
	values.push(projectId);
	db().prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteProject(projectId: string) {
	db().prepare('DELETE FROM projects WHERE id = ?').run(projectId);
}

export function listReports(projectId: string) {
	return db()
		.prepare(
			'SELECT id, name, updated_at, dataset_ref FROM reports WHERE project_id = ? ORDER BY updated_at DESC'
		)
		.all(projectId) as Array<{
		id: string;
		name: string;
		updated_at: number;
		dataset_ref: string | null;
	}>;
}

export function createReport(
	projectId: string,
	userId: string,
	opts: {
		name: string;
		blocksJson?: string;
		chatJson?: string;
		datasetRef?: string | null;
	}
) {
	const id = newId();
	const now = Date.now();
	db()
		.prepare(
			`INSERT INTO reports (id, project_id, name, blocks_json, chat_json, dataset_ref, created_by, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			id,
			projectId,
			opts.name,
			opts.blocksJson ?? EMPTY_BLOCKS_JSON,
			opts.chatJson ?? EMPTY_CHAT_JSON,
			opts.datasetRef ?? null,
			userId,
			now,
			now
		);
	db().prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, projectId);
	return { id, name: opts.name, updatedAt: now };
}

export function getReport(reportId: string): ReportRow | null {
	const row = db().prepare('SELECT * FROM reports WHERE id = ?').get(reportId) as
		| ReportRow
		| undefined;
	return row ?? null;
}

export function updateReport(
	reportId: string,
	patch: {
		name?: string;
		blocksJson?: string;
		chatJson?: string;
		datasetRef?: string | null;
	}
) {
	const fields: string[] = [];
	const values: unknown[] = [];
	if (typeof patch.name === 'string') {
		fields.push('name = ?');
		values.push(patch.name);
	}
	if (typeof patch.blocksJson === 'string') {
		fields.push('blocks_json = ?');
		values.push(patch.blocksJson);
	}
	if (typeof patch.chatJson === 'string') {
		fields.push('chat_json = ?');
		values.push(patch.chatJson);
	}
	if (patch.datasetRef !== undefined) {
		fields.push('dataset_ref = ?');
		values.push(patch.datasetRef);
	}
	if (!fields.length) return;
	const now = Date.now();
	fields.push('updated_at = ?');
	values.push(now);
	values.push(reportId);
	db().prepare(`UPDATE reports SET ${fields.join(', ')} WHERE id = ?`).run(...values);
	// Also bump the parent project's updated_at.
	db()
		.prepare(
			'UPDATE projects SET updated_at = ? WHERE id = (SELECT project_id FROM reports WHERE id = ?)'
		)
		.run(now, reportId);
}

export function deleteReport(reportId: string) {
	db().prepare('DELETE FROM reports WHERE id = ?').run(reportId);
}

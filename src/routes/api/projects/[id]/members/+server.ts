import { readJson } from '$lib/server/body';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addMemberByEmail, listMembers, requireRole } from '$lib/server/projects';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Not signed in');
	if (!requireRole(params.id, locals.user.id, 'viewer'))
		throw error(403, 'Not a member of this project');
	return json({
		members: listMembers(params.id).map((m) => ({
			userId: m.user_id,
			email: m.email,
			displayName: m.display_name,
			role: m.role,
			addedAt: m.added_at
		}))
	});
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'Not signed in');
	if (!requireRole(params.id, locals.user.id, 'owner'))
		throw error(403, 'owner role required');
	const body = (await readJson(request)) as {
		email?: string;
		role?: string;
	};
	const email = (body.email ?? '').trim();
	const role = body.role ?? 'viewer';
	if (!email) throw error(400, 'email is required');
	if (role !== 'owner' && role !== 'editor' && role !== 'viewer')
		throw error(400, 'invalid role');
	const res = addMemberByEmail(params.id, email, role);
	if (!res.ok) {
		if (res.error === 'not_found') throw error(404, 'No user with that email');
		if (res.error === 'exists') throw error(400, 'User is already a member');
		throw error(400, 'Invalid member');
	}
	return json({ ok: true, userId: res.userId }, { status: 201 });
};

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createProject, listProjectsForUser } from '$lib/server/projects';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Not signed in');
	return json({ projects: listProjectsForUser(locals.user.id) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Not signed in');
	const body = (await request.json().catch(() => ({}))) as {
		name?: string;
		description?: string;
	};
	const name = (body.name ?? '').trim();
	if (!name) throw error(400, 'name is required');
	const description = typeof body.description === 'string' ? body.description.trim() || null : null;
	const p = createProject(locals.user.id, name, description);
	return json({ project: { ...p, role: 'owner' } }, { status: 201 });
};

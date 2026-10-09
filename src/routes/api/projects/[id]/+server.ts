import { readJson } from '$lib/server/body';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	deleteProject,
	getProject,
	getRole,
	listMembers,
	listReports,
	requireRole,
	updateProject
} from '$lib/server/projects';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Not signed in');
	const role = getRole(params.id, locals.user.id);
	if (!role) throw error(403, 'Not a member of this project');
	const project = getProject(params.id);
	if (!project) throw error(404, 'Project not found');
	return json({
		project: {
			id: project.id,
			name: project.name,
			description: project.description,
			ownerId: project.owner_id,
			createdAt: project.created_at,
			updatedAt: project.updated_at,
			role
		},
		members: listMembers(params.id).map((m) => ({
			userId: m.user_id,
			email: m.email,
			displayName: m.display_name,
			role: m.role,
			addedAt: m.added_at
		})),
		reports: listReports(params.id).map((r) => ({
			id: r.id,
			name: r.name,
			updatedAt: r.updated_at,
			datasetRef: r.dataset_ref
		}))
	});
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'Not signed in');
	if (!requireRole(params.id, locals.user.id, 'editor'))
		throw error(403, 'editor role required');
	const body = (await readJson(request)) as {
		name?: string;
		description?: string | null;
	};
	const patch: { name?: string; description?: string | null } = {};
	if (typeof body.name === 'string') {
		const n = body.name.trim();
		if (!n) throw error(400, 'name cannot be empty');
		patch.name = n;
	}
	if (body.description !== undefined) {
		patch.description = typeof body.description === 'string' ? body.description : null;
	}
	updateProject(params.id, patch);
	const p = getProject(params.id);
	return json({ project: p });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Not signed in');
	if (!requireRole(params.id, locals.user.id, 'owner'))
		throw error(403, 'owner role required');
	deleteProject(params.id);
	return new Response(null, { status: 204 });
};

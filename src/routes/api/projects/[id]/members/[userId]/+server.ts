import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProject, getRole, removeMember } from '$lib/server/projects';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Not signed in');
	const project = getProject(params.id);
	if (!project) throw error(404, 'Project not found');
	// Owner or self may remove.
	const myRole = getRole(params.id, locals.user.id);
	if (!myRole) throw error(403, 'Not a member');
	const isSelf = params.userId === locals.user.id;
	if (myRole !== 'owner' && !isSelf) throw error(403, 'owner role required');
	// Don't allow removing the project owner.
	if (params.userId === project.owner_id)
		throw error(400, 'Cannot remove the project owner');
	removeMember(params.id, params.userId);
	return new Response(null, { status: 204 });
};

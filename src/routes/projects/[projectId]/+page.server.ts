import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProject, getRole, listMembers, listReports } from '$lib/server/projects';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/');
	const role = getRole(params.projectId, locals.user.id);
	if (!role) throw error(403, 'Not a member of this project');
	const project = getProject(params.projectId);
	if (!project) throw error(404, 'Project not found');
	return {
		project: {
			id: project.id,
			name: project.name,
			description: project.description,
			ownerId: project.owner_id,
			createdAt: project.created_at,
			updatedAt: project.updated_at,
			role
		},
		members: listMembers(params.projectId).map((m) => ({
			userId: m.user_id,
			email: m.email,
			displayName: m.display_name,
			role: m.role,
			addedAt: m.added_at
		})),
		reports: listReports(params.projectId).map((r) => ({
			id: r.id,
			name: r.name,
			updatedAt: r.updated_at,
			datasetRef: r.dataset_ref
		}))
	};
};

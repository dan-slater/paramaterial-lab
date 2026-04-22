import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listProjectsForUser } from '$lib/server/projects';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/');
	return { projects: listProjectsForUser(locals.user.id) };
};

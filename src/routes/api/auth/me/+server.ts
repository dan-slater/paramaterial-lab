import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Not signed in');
	return json({ user: locals.user });
};

import type { LayoutServerLoad } from './$types';
import { signupAllowed } from '$lib/server/config';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		allowSignup: signupAllowed()
	};
};

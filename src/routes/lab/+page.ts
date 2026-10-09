import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// /lab on its own has nothing to show; send it to the first preset.
export const load: PageLoad = () => {
	throw redirect(307, '/lab/materials');
};

import { error } from '@sveltejs/kit';
import { presetBySlug } from '$lib/datasets';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const preset = presetBySlug(params.preset);
	if (!preset) throw error(404, `No preset called "${params.preset}"`);
	return { preset };
};

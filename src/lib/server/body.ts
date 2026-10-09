import { error } from '@sveltejs/kit';

/**
 * Parse a JSON request body. Malformed JSON yields `{}` (callers validate
 * fields), but an over-limit body (BODY_SIZE_LIMIT) is a 413, not an empty
 * object: swallowing it turned an oversized report save into a silent no-op.
 */
export async function readJson<T extends object>(request: Request): Promise<Partial<T>> {
	try {
		return (await request.json()) as Partial<T>;
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e && e.status === 413) {
			throw error(413, 'Request body too large');
		}
		return {};
	}
}

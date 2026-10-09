import type { Handle } from '@sveltejs/kit';
import { getSessionUser, SESSION_COOKIE } from '$lib/server/auth';

/**
 * Reads the session cookie and populates `event.locals.user`. All API
 * endpoints consult `locals.user` rather than parsing cookies themselves.
 *
 * We also enforce a lightweight CSRF check on mutating API requests: either
 * the `origin` header must match the host, or an `x-requested-with:
 * paramaterial` header must be present (set by our client fetch helper).
 */
export const handle: Handle = async ({ event, resolve }) => {
	const sid = event.cookies.get(SESSION_COOKIE);
	const user = getSessionUser(sid);
	event.locals.user = user;
	event.locals.sessionId = sid ?? null;

	// Extra CSRF guard for /api/* mutations. SvelteKit's default CSRF
	// protection already covers form POSTs; this adds cover for JSON POSTs
	// that some browsers will let extensions submit cross-origin.
	if (event.url.pathname.startsWith('/api/') && event.request.method !== 'GET') {
		const method = event.request.method;
		const origin = event.request.headers.get('origin');
		const xrw = event.request.headers.get('x-requested-with');
		const host = event.request.headers.get('host');
		let sameOrigin = false;
		try {
			sameOrigin = !!origin && !!host && new URL(origin).host === host;
		} catch {
			sameOrigin = false;
		}
		const okXrw = xrw === 'paramaterial';
		if (!sameOrigin && !okXrw && method !== 'OPTIONS') {
			return new Response('Forbidden (csrf)', { status: 403 });
		}
	}

	return resolve(event);
};

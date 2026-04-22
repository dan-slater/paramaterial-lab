import type { RequestHandler } from './$types';
import { destroySession, SESSION_COOKIE } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies, locals }) => {
	destroySession(locals.sessionId ?? undefined);
	cookies.delete(SESSION_COOKIE, { path: '/' });
	return new Response(null, { status: 204 });
};

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticate, createSession, SESSION_COOKIE, SESSION_TTL } from '$lib/server/auth';

interface Body {
	email?: string;
	password?: string;
}

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const body = (await request.json().catch(() => ({}))) as Body;
	const email = (body.email ?? '').trim();
	const password = body.password ?? '';
	if (!email || !password) throw error(400, 'email and password are required');
	const user = await authenticate(email, password);
	if (!user) throw error(401, 'Invalid email or password');
	const session = createSession(user.id);
	cookies.set(SESSION_COOKIE, session.id, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: Math.floor(SESSION_TTL / 1000)
	});
	return json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
};

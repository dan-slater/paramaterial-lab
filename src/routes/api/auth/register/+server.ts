import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createUser, createSession, authenticate, SESSION_COOKIE, SESSION_TTL } from '$lib/server/auth';

interface Body {
	email?: string;
	password?: string;
	displayName?: string;
}

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const body = (await request.json().catch(() => ({}))) as Body;
	const email = (body.email ?? '').trim();
	const password = body.password ?? '';
	const displayName = (body.displayName ?? '').trim();
	if (!email || !password || !displayName) {
		throw error(400, 'email, password, and displayName are required');
	}
	if (password.length < 6) throw error(400, 'password must be at least 6 characters');

	const res = await createUser(email, password, displayName);
	if ('error' in res) {
		if (res.error === 'email_taken') throw error(400, 'Email already registered');
		throw error(400, 'Invalid registration');
	}
	const auth = await authenticate(email, password);
	if (!auth) throw error(500, 'Post-register authentication failed');
	const session = createSession(auth.id);
	cookies.set(SESSION_COOKIE, session.id, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: Math.floor(SESSION_TTL / 1000)
	});
	return json(
		{ user: { id: auth.id, email: auth.email, displayName: auth.displayName } },
		{ status: 201 }
	);
};

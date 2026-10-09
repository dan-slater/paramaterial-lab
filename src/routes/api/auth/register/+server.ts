import { readJson } from '$lib/server/body';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createUser, createSession, authenticate, SESSION_COOKIE, SESSION_TTL } from '$lib/server/auth';
import { DISPLAY_NAME_MAX, PASSWORD_MAX, PASSWORD_MIN, signupAllowed } from '$lib/server/config';
import { clientKey, LIMITS, rateLimit } from '$lib/server/rateLimit';

interface Body {
	email?: string;
	password?: string;
	displayName?: string;
}

export const POST: RequestHandler = async ({ request, cookies, url, getClientAddress }) => {
	if (!signupAllowed()) throw error(403, 'Registration is closed on this server');
	const wait = rateLimit(`register:${clientKey(getClientAddress)}`, LIMITS.register);
	if (wait !== null) {
		return json(
			{ message: 'Too many sign-ups from this address. Try again later.' },
			{ status: 429, headers: { 'retry-after': String(wait) } }
		);
	}

	const body = (await readJson(request)) as Body;
	const email = (body.email ?? '').trim();
	const password = body.password ?? '';
	const displayName = (body.displayName ?? '').trim();
	if (!email || !password || !displayName) {
		throw error(400, 'email, password, and displayName are required');
	}
	if (password.length < PASSWORD_MIN) {
		throw error(400, `password must be at least ${PASSWORD_MIN} characters`);
	}
	if (password.length > PASSWORD_MAX) {
		throw error(400, `password must be at most ${PASSWORD_MAX} characters`);
	}
	if (displayName.length > DISPLAY_NAME_MAX) {
		throw error(400, `display name must be at most ${DISPLAY_NAME_MAX} characters`);
	}

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

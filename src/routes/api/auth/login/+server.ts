import { readJson } from '$lib/server/body';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticate, createSession, SESSION_COOKIE, SESSION_TTL } from '$lib/server/auth';
import { PASSWORD_MAX } from '$lib/server/config';
import { clientKey, LIMITS, rateLimit } from '$lib/server/rateLimit';

interface Body {
	email?: string;
	password?: string;
}

export const POST: RequestHandler = async ({ request, cookies, url, getClientAddress }) => {
	// Every attempt counts, successful or not, so guessing is capped per address.
	const wait = rateLimit(`login:${clientKey(getClientAddress)}`, LIMITS.login);
	if (wait !== null) {
		return json(
			{ message: 'Too many sign-in attempts from this address. Try again later.' },
			{ status: 429, headers: { 'retry-after': String(wait) } }
		);
	}
	const body = (await readJson(request)) as Body;
	const email = (body.email ?? '').trim();
	const password = body.password ?? '';
	if (!email || !password) throw error(400, 'email and password are required');
	if (password.length > PASSWORD_MAX) throw error(401, 'Invalid email or password');
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

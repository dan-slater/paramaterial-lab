/**
 * Client-side signed-in-user store. Populated on page load via the layout's
 * load() function; mutated by the auth modal.
 */
import { api } from '$lib/api';

export interface Me {
	id: string;
	email: string;
	displayName: string;
}

const state = $state<{ user: Me | null; allowSignup: boolean }>({ user: null, allowSignup: true });

export const sessionStore = {
	get user() {
		return state.user;
	},
	setUser(u: Me | null) {
		state.user = u;
	},
	/** Whether the server accepts new accounts (ALLOW_SIGNUP). */
	get allowSignup() {
		return state.allowSignup;
	},
	setAllowSignup(v: boolean) {
		state.allowSignup = v;
	},
	async refresh() {
		try {
			const res = await api<{ user: Me }>('/api/auth/me');
			state.user = res.user;
		} catch {
			state.user = null;
		}
	},
	async login(email: string, password: string) {
		const res = await api<{ user: Me }>('/api/auth/login', {
			body: { email, password }
		});
		state.user = res.user;
	},
	async register(email: string, password: string, displayName: string) {
		const res = await api<{ user: Me }>('/api/auth/register', {
			body: { email, password, displayName }
		});
		state.user = res.user;
	},
	async logout() {
		await api<void>('/api/auth/logout', { method: 'POST' });
		state.user = null;
	}
};

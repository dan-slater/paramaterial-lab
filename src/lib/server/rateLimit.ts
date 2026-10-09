/**
 * In-process sliding-window rate limiter keyed by an arbitrary string (we use
 * `<bucket>:<client ip>`). Single Node process, so a Map is enough; counts reset
 * on restart, which is acceptable for slowing down signup spam and password
 * guessing. Not a substitute for an edge rule if the site is ever attacked.
 */
const hits = new Map<string, number[]>();
let lastSweep = Date.now();

export interface Limit {
	max: number;
	windowMs: number;
}

export const LIMITS = {
	login: { max: 10, windowMs: 15 * 60 * 1000 },
	register: { max: 5, windowMs: 60 * 60 * 1000 }
} satisfies Record<string, Limit>;

/** Records a hit and returns null if allowed, or seconds until the oldest hit expires. */
export function rateLimit(key: string, limit: Limit, now = Date.now()): number | null {
	sweep(now);
	const since = now - limit.windowMs;
	const list = (hits.get(key) ?? []).filter((t) => t > since);
	if (list.length >= limit.max) {
		hits.set(key, list);
		return Math.max(1, Math.ceil((list[0] + limit.windowMs - now) / 1000));
	}
	list.push(now);
	hits.set(key, list);
	return null;
}

// Drop idle keys every few minutes so the map cannot grow without bound.
function sweep(now: number) {
	if (now - lastSweep < 5 * 60 * 1000) return;
	lastSweep = now;
	const horizon = now - Math.max(...Object.values(LIMITS).map((l) => l.windowMs));
	for (const [k, list] of hits) if (!list.some((t) => t > horizon)) hits.delete(k);
}

/** Client address for rate limiting. Behind Cloudflare set ADDRESS_HEADER=CF-Connecting-IP
 *  so this is the visitor, not the tunnel. Falls back to 'unknown' rather than throwing. */
export function clientKey(getClientAddress: () => string): string {
	try {
		return getClientAddress() || 'unknown';
	} catch {
		return 'unknown';
	}
}

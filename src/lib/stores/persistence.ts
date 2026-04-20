// Browser-only localStorage persistence helpers.
// SSR-safe: every public function short-circuits if window/localStorage is missing.

export const STORAGE_KEYS = {
	blocks: 'paramaterial:blocks:v1',
	chat: 'paramaterial:chat:v1'
} as const;

function hasStorage(): boolean {
	return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadJSON<T>(key: string): T | null {
	if (!hasStorage()) return null;
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return null;
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

const timers: Record<string, ReturnType<typeof setTimeout> | undefined> = {};

// Debounced save — coalesces rapid writes into one commit after `delayMs` idle.
export function saveJSONDebounced(key: string, value: unknown, delayMs = 50): void {
	if (!hasStorage()) return;
	const prev = timers[key];
	if (prev) clearTimeout(prev);
	timers[key] = setTimeout(() => {
		try {
			window.localStorage.setItem(key, JSON.stringify(value));
		} catch (err) {
			// Typically quota-exceeded; fail silently so the app keeps working.
			// eslint-disable-next-line no-console
			console.warn('paramaterial: failed to persist', key, err);
		}
		timers[key] = undefined;
	}, delayMs);
}

export function clearKey(key: string): void {
	if (!hasStorage()) return;
	try {
		window.localStorage.removeItem(key);
	} catch {
		/* ignore */
	}
}

export function clearAll(): void {
	clearKey(STORAGE_KEYS.blocks);
	clearKey(STORAGE_KEYS.chat);
}

// Browser-only localStorage persistence helpers.
// SSR-safe: every public function short-circuits if window/localStorage is missing.

export const STORAGE_KEYS = {
	blocks: 'paramaterial:blocks:v1',
	chat: 'paramaterial:chat:v1'
} as const;

// ---------------------------------------------------------------------------
// Report-context flag. When a project report is open, stores should suppress
// the legacy localStorage autosave and defer to the server-backed one owned
// by the report page. In standalone / unauthenticated mode this flag stays
// `false` and the existing localStorage behavior is preserved.
// ---------------------------------------------------------------------------

let _inReportContext = false;

export function setInReportContext(v: boolean) {
	_inReportContext = v;
}

export function inReportContext(): boolean {
	return _inReportContext;
}

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
	// When a server-backed report is open, skip localStorage autosave; the
	// report page owns server sync and we don't want two sources of truth.
	if (_inReportContext) return;
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

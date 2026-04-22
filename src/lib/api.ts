/**
 * Thin client wrapper around `fetch` that adds the `x-requested-with`
 * header required by our hooks-level CSRF guard, and parses JSON + errors.
 */

interface ApiOpts {
	method?: string;
	body?: unknown;
	fetchFn?: typeof fetch;
}

export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export async function api<T = unknown>(path: string, opts: ApiOpts = {}): Promise<T> {
	const fetchFn = opts.fetchFn ?? fetch;
	const headers: Record<string, string> = {
		'x-requested-with': 'paramaterial'
	};
	let body: BodyInit | undefined;
	if (opts.body !== undefined) {
		headers['content-type'] = 'application/json';
		body = JSON.stringify(opts.body);
	}
	const res = await fetchFn(path, {
		method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
		headers,
		body,
		credentials: 'same-origin'
	});
	if (res.status === 204) return undefined as T;
	const text = await res.text();
	let data: unknown = null;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		// non-JSON error body
	}
	if (!res.ok) {
		const msg =
			(data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string'
				? (data as { message: string }).message
				: null) ??
			text ??
			`HTTP ${res.status}`;
		throw new ApiError(res.status, msg);
	}
	return data as T;
}

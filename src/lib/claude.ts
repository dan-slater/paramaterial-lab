// Browser-side client for the Anthropic Messages API.
// Uses `anthropic-dangerous-direct-browser-access` so this runs without a server
// proxy. Intended for personal use; the user provides their own API key via the
// settings cog and the key is stored only in their own localStorage.

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
// Current Sonnet as of 2026-10 (Claude Sonnet 5.5). Thinking is on by default on
// this model, so requests set a low effort (chat route) and leave room in
// max_tokens; forced tool_choice, thinking:disabled and temperature are rejected,
// and this client sends none of them.
export const CLAUDE_MODEL = 'claude-sonnet-5-5';

export const APIKEY_STORAGE_KEY = 'paramaterial:apikey:v1';

// Minimal shape of the Anthropic messages API; we only declare what we use.
export type ContentBlock =
	| { type: 'text'; text: string }
	| { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
	| {
			type: 'tool_result';
			tool_use_id: string;
			content: string | Array<{ type: 'text'; text: string }>;
			is_error?: boolean;
	  };

export interface ApiMessage {
	role: 'user' | 'assistant';
	content: string | ContentBlock[];
}

export interface ToolSchema {
	name: string;
	description: string;
	input_schema: {
		type: 'object';
		properties: Record<string, unknown>;
		required?: string[];
	};
}

export interface MessagesRequest {
	system?: string;
	messages: ApiMessage[];
	tools?: ToolSchema[];
	max_tokens?: number;
}

export interface MessagesResponse {
	id: string;
	type: 'message';
	role: 'assistant';
	model: string;
	stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | string;
	content: ContentBlock[];
	usage?: { input_tokens: number; output_tokens: number };
}

export class ClaudeError extends Error {
	status?: number;
	constructor(message: string, status?: number) {
		super(message);
		this.name = 'ClaudeError';
		this.status = status;
	}
}

export function getApiKey(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		const v = window.localStorage.getItem(APIKEY_STORAGE_KEY);
		return v && v.length > 0 ? v : null;
	} catch {
		return null;
	}
}

export function setApiKey(key: string): void {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(APIKEY_STORAGE_KEY, key);
	} catch {
		/* quota or unavailable; nothing to do */
	}
}

export function clearApiKey(): void {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.removeItem(APIKEY_STORAGE_KEY);
	} catch {
		/* ignore */
	}
}

export function hasApiKey(): boolean {
	return !!getApiKey();
}

// POST /v1/messages. Throws ClaudeError on failure; never includes the API key
// in the error message.
export async function callClaude(req: MessagesRequest): Promise<MessagesResponse> {
	const key = getApiKey();
	if (!key) throw new ClaudeError('No API key set.');

	const body = {
		model: CLAUDE_MODEL,
		max_tokens: req.max_tokens ?? 4096,
		output_config: { effort: 'low' },
		system: req.system,
		messages: req.messages,
		tools: req.tools
	};

	let res: Response;
	try {
		res = await fetch(API_URL, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-api-key': key,
				'anthropic-version': API_VERSION,
				'anthropic-dangerous-direct-browser-access': 'true'
			},
			body: JSON.stringify(body)
		});
	} catch (e) {
		// Network-level failure (DNS, CORS, offline, etc.)
		const msg = e instanceof Error ? e.message : String(e);
		throw new ClaudeError(`Network error contacting Claude API: ${msg}`);
	}

	if (!res.ok) {
		let detail = '';
		try {
			const errBody = await res.json();
			detail = errBody?.error?.message ?? '';
		} catch {
			/* body wasn't json; ignore */
		}
		// Scrub anything that even looks like a key — defense in depth.
		detail = detail.replace(/sk-[A-Za-z0-9\-_]+/g, '[redacted]');
		if (res.status === 401) {
			throw new ClaudeError(
				`Authentication failed (401). Check your API key in Settings. ${detail}`,
				401
			);
		}
		if (res.status === 429) {
			throw new ClaudeError(
				`Rate limited (429). Wait a moment and try again. ${detail}`,
				429
			);
		}
		if (res.status === 400) {
			throw new ClaudeError(`Bad request (400): ${detail}`, 400);
		}
		throw new ClaudeError(`Claude API error (${res.status}): ${detail}`, res.status);
	}

	try {
		return (await res.json()) as MessagesResponse;
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		throw new ClaudeError(`Failed to parse Claude response: ${msg}`);
	}
}

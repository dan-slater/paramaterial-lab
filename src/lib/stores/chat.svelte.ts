import { blocksStore, TOOLS, type BlockType } from './blocks.svelte';
import { loadJSON, saveJSONDebounced, STORAGE_KEYS } from './persistence';

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	text: string;
	ts: number;
	toolCalled?: BlockType;
}

interface PersistedShape {
	v: 1;
	messages: ChatMessage[];
}

const welcomeMessage = (): ChatMessage => ({
	id: 'welcome',
	role: 'assistant',
	text:
		'Hi — I can add analysis blocks to the report. Try: "plot stress vs strain", "find UTS and proof stress", "show representative curves by temperature".',
	ts: Date.now()
});

function hydrate(): ChatMessage[] {
	const saved = loadJSON<PersistedShape>(STORAGE_KEYS.chat);
	if (saved && saved.v === 1 && Array.isArray(saved.messages) && saved.messages.length > 0) {
		return saved.messages;
	}
	return [welcomeMessage()];
}

const state = $state<{ messages: ChatMessage[]; busy: boolean }>({
	messages: hydrate(),
	busy: false
});

if (typeof window !== 'undefined') {
	$effect.root(() => {
		$effect(() => {
			const snapshot = state.messages.map((m) => ({
				id: m.id,
				role: m.role,
				text: m.text,
				ts: m.ts,
				toolCalled: m.toolCalled
			}));
			const payload: PersistedShape = { v: 1, messages: snapshot };
			saveJSONDebounced(STORAGE_KEYS.chat, payload, 50);
		});
		return () => {};
	});
}

let counter = 0;
function newId(prefix: string): string {
	counter += 1;
	return `${prefix}-${counter}-${Date.now().toString(36)}`;
}

// Rule-based intent → tool picker. Covers the common cases; real Claude calls
// can replace this later by returning the same tool string.
function pickTool(userText: string): BlockType | null {
	const q = userText.toLowerCase();
	if (/ramberg[\s\-]*osgood|power[\s\-]*law/.test(q)) return 'ramberg-osgood';
	if (/zener[\s\-]*hollomon|activation energy|\bzener\b|\bhollomon\b/.test(q)) return 'zener-hollomon';
	if (/stress.*strain|plot|curves?$/.test(q) && !/representat|foot|proof|uts|modulus|scatter|ramberg|zener|power/.test(q))
		return 'stress-strain';
	if (/foot|upl|lpl|elastic region/.test(q)) return 'foot-correction';
	if (/uts|proof|modulus|young|properties|table/.test(q)) return 'property-table';
	if (/representat|mean|envelope|band|std/.test(q)) return 'representative-curves';
	if (/scatter|vs\s+temperature|parameter.*vs/.test(q)) return 'scatter';
	if (/note|annot|comment/.test(q)) return 'note';
	return null;
}

export const chatStore = {
	get messages() {
		return state.messages;
	},
	get busy() {
		return state.busy;
	},
	async send(text: string) {
		const trimmed = text.trim();
		if (!trimmed) return;
		state.messages.push({
			id: newId('user'),
			role: 'user',
			text: trimmed,
			ts: Date.now()
		});
		state.busy = true;
		// Fake async "thinking" delay
		await new Promise((r) => setTimeout(r, 350));
		const tool = pickTool(trimmed);
		if (tool) {
			const toolDef = TOOLS.find((t) => t.type === tool);
			blocksStore.add(tool);
			state.messages.push({
				id: newId('asst'),
				role: 'assistant',
				text: `Added a **${toolDef?.label ?? tool}** block to the report. ${toolDef?.description ?? ''}`,
				ts: Date.now(),
				toolCalled: tool
			});
		} else {
			state.messages.push({
				id: newId('asst'),
				role: 'assistant',
				text:
					"I couldn't match that to a tool. Try mentioning stress–strain, foot correction, properties/UTS, representative curves, or scatter.",
				ts: Date.now()
			});
		}
		state.busy = false;
	},
	clear() {
		state.messages = [
			{
				id: 'welcome',
				role: 'assistant',
				text: 'Ready. What should I add next?',
				ts: Date.now()
			}
		];
	},
	replaceAll(messages: ChatMessage[]) {
		state.messages = messages.slice();
	}
};

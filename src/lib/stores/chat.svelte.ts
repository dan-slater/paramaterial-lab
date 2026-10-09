import { blocksStore, TOOLS, type BlockType } from './blocks.svelte';
import { datasetStore } from './dataset.svelte';
import { getSeriesLabels } from '$lib/analyzers/registry';
import { loadJSON, saveJSONDebounced, STORAGE_KEYS } from './persistence';
import {
	callClaude,
	ClaudeError,
	hasApiKey,
	type ApiMessage,
	type ContentBlock,
	type ToolSchema
} from '$lib/claude';

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	text: string;
	ts: number;
	toolCalled?: BlockType;
	error?: boolean;
}

interface PersistedShape {
	v: 1;
	messages: ChatMessage[];
}

const WELCOME_PREFIX = 'Hi — I can add analysis blocks to the report.';

const welcomeMessage = (): ChatMessage => ({
	id: 'welcome',
	role: 'assistant',
	text: WELCOME_PREFIX,
	ts: Date.now()
});

/** The greeting's example prompts follow the loaded dataset's domain, so they are
 *  filled in at render time rather than stored with the message. */
export function displayText(m: ChatMessage): string {
	if (m.id !== 'welcome' || !m.text.startsWith(WELCOME_PREFIX)) return m.text;
	const labels = getSeriesLabels(datasetStore.current);
	const tries = labels.offsetLine
		? ['plot stress vs strain', 'find UTS and proof stress', 'show representative curves by temperature']
		: [labels.chatHint, 'add the parameters table', 'scatter two parameters'];
	return `${WELCOME_PREFIX} Try: ${tries.map((t) => `"${t}"`).join(', ')}.`;
}

function hydrate(): ChatMessage[] {
	const saved = loadJSON<PersistedShape>(STORAGE_KEYS.chat);
	if (saved && saved.v === 1 && Array.isArray(saved.messages) && saved.messages.length > 0) {
		return saved.messages;
	}
	return [welcomeMessage()];
}

const state = $state<{ messages: ChatMessage[]; busy: boolean; usingClaude: boolean }>({
	messages: hydrate(),
	busy: false,
	usingClaude: typeof window !== 'undefined' ? hasApiKey() : false
});

if (typeof window !== 'undefined') {
	$effect.root(() => {
		$effect(() => {
			const snapshot = state.messages.map((m) => ({
				id: m.id,
				role: m.role,
				text: m.text,
				ts: m.ts,
				toolCalled: m.toolCalled,
				error: m.error
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

// Rule-based intent → tool picker. Used as a fallback when no API key is set.
function pickTool(userText: string): BlockType | null {
	const q = userText.toLowerCase();
	if (/summar(y|ise|ize)|overview|describe\s+dataset|dataset\s+info/.test(q)) return 'dataset-summary';
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

// ---------------------------------------------------------------------------
// Tool schema — one tool per add_* block plus a describe_dataset read-only tool.
// Keep the JSON Schema minimal; Claude is happy with just property names + types.
// ---------------------------------------------------------------------------

const TOOL_SCHEMAS: ToolSchema[] = [
	{
		name: 'add_stress_strain',
		description: 'Append a stress–strain plot block that shows σ vs ε for every test in the dataset. Optionally color by a metadata column.',
		input_schema: {
			type: 'object',
			properties: {
				color_by: {
					type: 'string',
					description: 'Name of an info column to color curves by (e.g. "temperature", "lot").'
				}
			}
		}
	},
	{
		name: 'add_foot_correction',
		description: 'Append a foot-correction block that locates the elastic region (UPL/LPL) and shifts curves to zero strain.',
		input_schema: {
			type: 'object',
			properties: {
				test_id: { type: 'string', description: 'Optional specific test_id to focus on.' }
			}
		}
	},
	{
		name: 'add_property_table',
		description: 'Append a per-test property table (UTS, Young\'s modulus E, 0.2% proof stress).',
		input_schema: { type: 'object', properties: {} }
	},
	{
		name: 'add_representative_curves',
		description: 'Append a representative-curves block: group tests by a metadata column, interpolate and compute mean ± std per group.',
		input_schema: {
			type: 'object',
			properties: {
				group_by: {
					type: 'string',
					description: 'Info column used to group curves (e.g. "temperature").'
				}
			}
		}
	},
	{
		name: 'add_scatter',
		description: 'Append a scatter plot of an extracted mechanical property against a metadata column (e.g. UTS vs temperature).',
		input_schema: {
			type: 'object',
			properties: {
				y: {
					type: 'string',
					enum: ['UTS', 'E', 'PS'],
					description: 'Which property to put on the y-axis.'
				},
				x: { type: 'string', description: 'Info column for the x-axis.' }
			},
			required: ['y', 'x']
		}
	},
	{
		name: 'add_ramberg_osgood',
		description: 'Append a Ramberg–Osgood power-law fit (σ = C·ε^n) in the plastic region, per test.',
		input_schema: { type: 'object', properties: {} }
	},
	{
		name: 'add_zener_hollomon',
		description: 'Append a Zener–Hollomon regression: ln σ vs ln Z using strain rate and temperature. Optionally specify activation energy Q and flow strain.',
		input_schema: {
			type: 'object',
			properties: {
				Q_kJmol: { type: 'number', description: 'Activation energy in kJ/mol.' },
				flow_strain: { type: 'number', description: 'Strain at which to evaluate flow stress.' }
			}
		}
	},
	{
		name: 'add_note',
		description: 'Append a free-text note/annotation to the report.',
		input_schema: {
			type: 'object',
			properties: {
				text: { type: 'string', description: 'The note contents.' }
			},
			required: ['text']
		}
	},
	{
		name: 'describe_dataset',
		description:
			'Read-only: returns a concise summary of the currently-loaded dataset (number of tests, info columns, stress/strain ranges). Use this to answer questions about the data WITHOUT adding a block.',
		input_schema: { type: 'object', properties: {} }
	}
];

const ADD_TOOL_TO_BLOCK: Record<string, BlockType> = {
	add_stress_strain: 'stress-strain',
	add_foot_correction: 'foot-correction',
	add_property_table: 'property-table',
	add_representative_curves: 'representative-curves',
	add_scatter: 'scatter',
	add_ramberg_osgood: 'ramberg-osgood',
	add_zener_hollomon: 'zener-hollomon',
	add_note: 'note'
};

function describeDataset(): string {
	const ds = datasetStore.current;
	if (!ds) return 'No dataset is currently loaded.';
	const tests = ds.tests ?? [];
	let minStress = Infinity;
	let maxStress = -Infinity;
	let minStrain = Infinity;
	let maxStrain = -Infinity;
	for (const t of tests) {
		for (const s of t.stress ?? []) {
			if (s < minStress) minStress = s;
			if (s > maxStress) maxStress = s;
		}
		for (const e of t.strain ?? []) {
			if (e < minStrain) minStrain = e;
			if (e > maxStrain) maxStrain = e;
		}
	}
	const lines = [
		`Dataset: ${ds.name} (${ds.id})`,
		`Description: ${ds.description ?? '(none)'}`,
		`Tests: ${tests.length}`,
		`Info columns: ${(ds.info_columns ?? []).join(', ') || '(none)'}`
	];
	if (isFinite(minStress)) {
		lines.push(
			`Stress range: ${minStress.toFixed(2)} – ${maxStress.toFixed(2)}`,
			`Strain range: ${minStrain.toFixed(4)} – ${maxStrain.toFixed(4)}`
		);
	}
	return lines.join('\n');
}

function buildSystemPrompt(): string {
	const ds = datasetStore.current;
	const base =
		'You are an assistant inside a materials-science data-analysis web app ("paramaterial"). ' +
		'The user views a scrollable notebook of analysis blocks (plots, tables, notes) for a dataset ' +
		'of uniaxial/plane-strain tension or compression tests. ' +
		'You can add analysis blocks to the report via the add_* tools, or answer questions about the ' +
		'data (use describe_dataset to read a summary first). Be concise. When a user asks for a plot ' +
		'or analysis, prefer calling the appropriate add_* tool rather than describing what you would do. ' +
		'After a tool call you will receive a tool_result; then write a short plain-text confirmation ' +
		'(1-2 sentences) of what you added and why. Do not call more than a few tools per turn.';
	if (!ds) {
		return base + '\n\nNo dataset is currently loaded. Ask the user to pick one from the dataset-picker block at the top of the notebook.';
	}
	const testsCount = ds.tests?.length ?? 0;
	const cols = (ds.info_columns ?? []).join(', ') || '(none)';
	return (
		base +
		`\n\nLoaded dataset: ${ds.name} (${ds.id}). ${testsCount} tests. Info columns: ${cols}.`
	);
}

// Convert persisted chat history into the alternating user/assistant wire
// format the Anthropic API expects. We only send text content from history —
// old tool_use/tool_result exchanges are summarized into the assistant text
// that was rendered to the user, which is sufficient context for continuity.
function historyToApiMessages(messages: ChatMessage[], currentUserText: string): ApiMessage[] {
	const out: ApiMessage[] = [];
	for (const m of messages) {
		if (m.id === 'welcome') continue;
		if (!m.text || m.error) continue;
		out.push({ role: m.role, content: m.text });
	}
	out.push({ role: 'user', content: currentUserText });
	// Ensure we don't start with an assistant message (Anthropic rejects that).
	while (out.length && out[0].role !== 'user') out.shift();
	return out;
}

const MAX_TOOL_ROUNDS = 5;

async function sendViaClaude(userText: string) {
	const system = buildSystemPrompt();
	const apiMessages = historyToApiMessages(state.messages.slice(0, -1), userText);

	let finalText = '';
	const toolsCalled: BlockType[] = [];

	for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
		const res = await callClaude({
			system,
			messages: apiMessages,
			tools: TOOL_SCHEMAS,
			max_tokens: 4096
		});

		// Collect any text the model emitted and append its full content block as
		// the next assistant turn so tool_use ids match when we send tool_result.
		const textParts: string[] = [];
		const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
		for (const block of res.content) {
			if (block.type === 'text') textParts.push(block.text);
			else if (block.type === 'tool_use')
				toolUses.push({ id: block.id, name: block.name, input: block.input ?? {} });
		}
		if (textParts.length) finalText = textParts.join('\n\n').trim();

		if (res.stop_reason === 'refusal' && !finalText) {
			finalText = 'Claude declined this request. Try rephrasing it as an analysis step.';
		}
		if (res.stop_reason !== 'tool_use' || toolUses.length === 0) {
			// Model is done.
			break;
		}

		// Record the assistant turn verbatim so the server-side conversation
		// matches what we'll respond to with tool_result.
		apiMessages.push({ role: 'assistant', content: res.content });

		// Execute every tool_use in order; collect results.
		const resultBlocks: ContentBlock[] = [];
		for (const tu of toolUses) {
			try {
				if (tu.name === 'describe_dataset') {
					resultBlocks.push({
						type: 'tool_result',
						tool_use_id: tu.id,
						content: describeDataset()
					});
				} else if (ADD_TOOL_TO_BLOCK[tu.name]) {
					const blockType = ADD_TOOL_TO_BLOCK[tu.name];
					// The tool input becomes the block config. Strip anything non-JSON.
					let config: Record<string, unknown> = {};
					try {
						config = JSON.parse(JSON.stringify(tu.input ?? {}));
					} catch {
						config = {};
					}
					blocksStore.add(blockType, config);
					toolsCalled.push(blockType);
					resultBlocks.push({
						type: 'tool_result',
						tool_use_id: tu.id,
						content: `Added a ${blockType} block to the report.`
					});
				} else {
					resultBlocks.push({
						type: 'tool_result',
						tool_use_id: tu.id,
						content: `Unknown tool: ${tu.name}`,
						is_error: true
					});
				}
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				resultBlocks.push({
					type: 'tool_result',
					tool_use_id: tu.id,
					content: `Tool execution failed: ${msg}`,
					is_error: true
				});
			}
		}
		apiMessages.push({ role: 'user', content: resultBlocks });
		// Loop: let Claude react to the tool results.
	}

	if (!finalText) {
		if (toolsCalled.length > 0) {
			finalText =
				'Added ' +
				toolsCalled
					.map((t) => TOOLS.find((x) => x.type === t)?.label ?? t)
					.join(', ') +
				' to the report.';
		} else {
			finalText = '(no response)';
		}
	}

	state.messages.push({
		id: newId('asst'),
		role: 'assistant',
		text: finalText,
		ts: Date.now(),
		toolCalled: toolsCalled[0]
	});
}

async function sendViaFallback(userText: string) {
	// Preserve the original rule-based UX, including the short delay.
	await new Promise((r) => setTimeout(r, 350));
	const tool = pickTool(userText);
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
}

export const chatStore = {
	get messages() {
		return state.messages;
	},
	get busy() {
		return state.busy;
	},
	get usingClaude() {
		return state.usingClaude;
	},
	refreshMode() {
		state.usingClaude = hasApiKey();
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
		state.usingClaude = hasApiKey();
		try {
			if (state.usingClaude) {
				await sendViaClaude(trimmed);
			} else {
				await sendViaFallback(trimmed);
			}
		} catch (e) {
			// Surface API/network failures as a red assistant message. Never include
			// the key in the text (ClaudeError already scrubs it defensively).
			const msg =
				e instanceof ClaudeError
					? e.message
					: e instanceof Error
						? e.message
						: String(e);
			state.messages.push({
				id: newId('asst'),
				role: 'assistant',
				text: `Error: ${msg}`,
				ts: Date.now(),
				error: true
			});
		} finally {
			state.busy = false;
		}
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

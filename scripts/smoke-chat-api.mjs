#!/usr/bin/env node
// Smoke test for the Claude-backed chat flow.
// 1. Seed localStorage with a fake API key.
// 2. Stub window.fetch so the Anthropic endpoint returns a canned tool_use
//    response (add_note {text:"test"}) followed by an end_turn text response.
// 3. Submit a chat message.
// 4. Verify a note block was added and the mode indicator says "using Claude".
// 5. Restore the original fetch.

import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const APIKEY_STORAGE_KEY = 'paramaterial:apikey:v1';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

function fail(msg) {
	console.error('FAIL:', msg);
	process.exit(1);
}

// 1) Visit the page fresh and seed the fake API key before any chat code runs.
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.evaluate((key) => {
	localStorage.clear();
	localStorage.setItem(key, 'sk-fake-test');
}, APIKEY_STORAGE_KEY);

// 2) Reload so the chat store reads the fake key and flips to Claude mode,
//    then install the fetch stub BEFORE user interaction.
await page.reload({ waitUntil: 'networkidle' });
await page.evaluate(() => {
	const calls = [];
	window.__originalFetch = window.fetch;
	window.__fetchCalls = calls;
	let round = 0;
	window.fetch = async (url, opts) => {
		const u = typeof url === 'string' ? url : url.url;
		if (u.includes('api.anthropic.com')) {
			calls.push({ url: u, round });
			round += 1;
			if (round === 1) {
				// First turn: tool_use add_note({text:"test"})
				return new Response(
					JSON.stringify({
						id: 'msg_test_1',
						type: 'message',
						role: 'assistant',
						model: 'claude-sonnet-4-6',
						stop_reason: 'tool_use',
						content: [
							{ type: 'text', text: 'Adding a note for you.' },
							{
								type: 'tool_use',
								id: 'toolu_test_1',
								name: 'add_note',
								input: { text: 'test' }
							}
						]
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				);
			}
			// Second turn after tool_result: plain text end_turn.
			return new Response(
				JSON.stringify({
					id: 'msg_test_2',
					type: 'message',
					role: 'assistant',
					model: 'claude-sonnet-4-6',
					stop_reason: 'end_turn',
					content: [{ type: 'text', text: 'Done — added the note.' }]
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			);
		}
		return window.__originalFetch(url, opts);
	};
});

// Mode indicator should now say "using Claude".
await page.waitForSelector('[data-testid="chat-mode"]', { timeout: 10000 });
await page.waitForFunction(
	() => /using Claude/i.test(document.querySelector('[data-testid="chat-mode"]')?.textContent ?? ''),
	{ timeout: 5000 }
);
const modeText = await page.evaluate(
	() => document.querySelector('[data-testid="chat-mode"]')?.textContent ?? ''
);
if (!/using Claude/i.test(modeText)) fail(`mode indicator wrong: "${modeText.trim()}"`);
console.log('mode indicator: OK ("using Claude")');

// Pick a preset so datasetStore has content for the system prompt.
await page.evaluate(() => {
	const btn = [...document.querySelectorAll('button')].find((b) =>
		b.textContent?.includes('Basic Usage')
	);
	btn?.click();
});
await page.waitForTimeout(1200);

const blocksBefore = await page.locator('main article').count();

// 3) Submit a chat message.
await page.evaluate(() => {
	const ta = document.querySelector('textarea[placeholder*="analysis"]');
	const setter = Object.getOwnPropertyDescriptor(
		window.HTMLTextAreaElement.prototype,
		'value'
	).set;
	setter.call(ta, 'add a quick note');
	ta.dispatchEvent(new Event('input', { bubbles: true }));
	const form = ta.closest('form');
	form?.requestSubmit?.() ??
		form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
});
await page.waitForTimeout(1500);

// 4) Verify a note block was added and two API round-trips happened.
const blocksAfter = await page.locator('main article').count();
const fetchRounds = await page.evaluate(() => window.__fetchCalls?.length ?? 0);
const types = await page.evaluate(() => {
	const blocks = JSON.parse(localStorage.getItem('paramaterial:blocks:v1') ?? '{}');
	return (blocks.blocks ?? []).map((b) => b.type);
});
const lastAsst = await page.evaluate(() => {
	const chat = JSON.parse(localStorage.getItem('paramaterial:chat:v1') ?? '{}');
	const msgs = chat.messages ?? [];
	const a = msgs.filter((m) => m.role === 'assistant').pop();
	return a?.text ?? '';
});

if (blocksAfter !== blocksBefore + 1)
	fail(`expected block count ${blocksBefore + 1}, got ${blocksAfter}`);
if (!types.includes('note')) fail(`expected a 'note' block in storage, got ${JSON.stringify(types)}`);
if (fetchRounds !== 2) fail(`expected 2 API calls (tool_use + tool_result), got ${fetchRounds}`);
if (!/added the note/i.test(lastAsst))
	fail(`expected final assistant text to mention note; got "${lastAsst}"`);

// Also verify the note's config carries the tool-use input text through.
const noteText = await page.evaluate(() => {
	const blocks = JSON.parse(localStorage.getItem('paramaterial:blocks:v1') ?? '{}').blocks ?? [];
	const n = blocks.find((b) => b.type === 'note');
	return n?.config?.text ?? '';
});
if (noteText !== 'test') fail(`expected note.config.text === "test", got "${noteText}"`);

// 5) Restore original fetch.
await page.evaluate(() => {
	if (window.__originalFetch) window.fetch = window.__originalFetch;
});

const realErrors = errors.filter((e) => !/404.*Not Found/.test(e));
if (realErrors.length) {
	console.error('console errors:', realErrors);
	process.exit(1);
}

console.log(
	JSON.stringify(
		{ blocksBefore, blocksAfter, types, fetchRounds, lastAsst, noteText, pass: true },
		null,
		2
	)
);
await browser.close();
console.log('chat-api smoke: PASS');

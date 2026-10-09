#!/usr/bin/env node
/**
 * Hosted-mode smoke: boots `node build` the way the systemd unit does (env only,
 * DATA_DIR rather than DB_PATH) and checks what a public deployment needs:
 * anonymous use without touching SQLite, static presets, the error page,
 * sign-up hardening (password floor, per-IP rate limits, ALLOW_SIGNUP) and the
 * CSRF origin check. Restarts once with ALLOW_SIGNUP=false.
 *
 *   npm run build && node scripts/smoke-hosted.mjs      (port: SMOKE_PORT, default 3081)
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.SMOKE_PORT ?? 3081);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = mkdtempSync(join(tmpdir(), 'pm-lab-hosted-'));

let passes = 0;
let fails = 0;
function check(cond, msg) {
	console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
	if (cond) passes++;
	else fails++;
}

let server = null;
async function start(extraEnv) {
	const env = {
		...process.env,
		PORT: String(PORT),
		HOST: '127.0.0.1',
		ORIGIN: BASE,
		DATA_DIR: DATA,
		...extraEnv
	};
	delete env.DB_PATH;
	server = spawn('node', ['build'], { cwd: root, env, stdio: ['ignore', 'pipe', 'inherit'] });
	for (let i = 0; i < 50; i++) {
		try {
			const r = await fetch(BASE + '/robots.txt');
			if (r.ok) return;
		} catch {
			/* not up yet */
		}
		await delay(200);
	}
	throw new Error('server did not start');
}
async function stop() {
	if (!server) return;
	const s = server;
	server = null;
	s.kill('SIGTERM');
	await new Promise((r) => s.once('exit', r));
}

let cookie = '';
async function call(method, path, body, headers = {}) {
	const h = { 'content-type': 'application/json', 'x-requested-with': 'paramaterial', ...headers };
	if (cookie) h.cookie = cookie;
	const res = await fetch(BASE + path, {
		method,
		headers: h,
		body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
	});
	const set = res.headers.get('set-cookie');
	if (set) cookie = set.split(';')[0];
	return res;
}
const dbFiles = () => readdirSync(DATA).filter((f) => f.endsWith('.db'));

try {
	if (!existsSync(join(root, 'build/index.js'))) throw new Error('run `npm run build` first');

	// --- run 1: defaults (signup open, adapter-node default body limit) -----
	await start({});

	for (const p of ['/', '/docs', '/lab/materials', '/lab/finance', '/lab/climate', '/lab/battery']) {
		const r = await fetch(BASE + p);
		check(r.status === 200, `GET ${p} -> ${r.status}`);
	}
	{
		const r = await fetch(BASE + '/lab/nope');
		const html = await r.text();
		check(r.status === 404 && html.includes('No such page'), `GET /lab/nope -> ${r.status} with error page`);
		const r2 = await fetch(BASE + '/no/such/thing');
		check(r2.status === 404, `GET /no/such/thing -> ${r2.status}`);
	}
	for (const id of ['basic-usage', 'cs1', 'cs2', 'cs3', 'cs4', 'finance', 'climate', 'battery']) {
		const r = await fetch(`${BASE}/data/${id}.json`);
		const ct = r.headers.get('content-type') ?? '';
		check(r.status === 200 && ct.includes('json'), `static /data/${id}.json -> ${r.status} ${ct}`);
		await r.arrayBuffer();
	}
	{
		const r = await fetch(BASE + '/samples/climate-long.csv');
		check(r.status === 200 && (await r.text()).startsWith('station,day'), 'static /samples/climate-long.csv');
		const robots = await (await fetch(BASE + '/robots.txt')).text();
		check(/User-agent: \*/.test(robots) && /^Disallow:\s*$/m.test(robots), 'robots.txt allows everything');
	}
	check((await call('GET', '/api/auth/me')).status === 401, 'anonymous /api/auth/me -> 401');
	check(dbFiles().length === 0, `anonymous browsing never opened SQLite (DATA_DIR: ${dbFiles().join(',') || 'empty'})`);

	// Password floor and caps.
	let r = await call('POST', '/api/auth/register', { email: 'a@example.com', password: 'short', displayName: 'A' });
	check(r.status === 400, `register with 5-char password -> ${r.status}`);
	r = await call('POST', '/api/auth/register', { email: 'alice@example.com', password: 'correct horse', displayName: 'Alice' });
	check(r.status === 201, `register with 13-char password -> ${r.status}`);
	check(dbFiles().includes('paramaterial.db'), `DATA_DIR now holds ${dbFiles().join(',')}`);
	check((await call('GET', '/api/auth/me')).status === 200, 'session cookie works');

	// CSRF: exact origin match, look-alike rejected, no x-requested-with.
	const evil = await call('POST', '/api/projects', { name: 'x' }, { origin: 'https://evil.example', 'x-requested-with': '' });
	check(evil.status === 403, `cross-origin POST -> ${evil.status}`);
	const lookalike = await call('POST', '/api/projects', { name: 'x' }, { origin: `http://x127.0.0.1:${PORT}`, 'x-requested-with': '' });
	check(lookalike.status === 403, `look-alike origin POST -> ${lookalike.status} (endsWith would have allowed it)`);
	const same = await call('POST', '/api/projects', { name: 'mine' }, { origin: BASE, 'x-requested-with': '' });
	check(same.status === 201 || same.status === 200, `same-origin POST -> ${same.status}`);

	// Default body limit (512K) refuses a 1 MB body with 413 (readJson surfaces it
	// instead of treating it as an empty body).
	const big = JSON.stringify({ name: 'big', description: 'd'.repeat(1_000_000) });
	r = await call('POST', '/api/projects', big);
	check(r.status === 413, `1 MB project body with default BODY_SIZE_LIMIT -> ${r.status}`);

	// Login rate limit: 10 attempts per window, the 11th is refused.
	cookie = '';
	const codes = [];
	for (let i = 0; i < 11; i++) {
		const x = await call('POST', '/api/auth/login', { email: 'alice@example.com', password: 'wrong password' });
		codes.push(x.status);
		if (x.status === 429) check(Number(x.headers.get('retry-after')) > 0, `429 carries retry-after ${x.headers.get('retry-after')}s`);
	}
	check(codes.slice(0, 10).every((c) => c === 401) && codes[10] === 429, `11 bad logins -> ${codes.join(',')}`);

	// Register rate limit: 2 attempts so far; 3 more allowed, then 429.
	const reg = [];
	for (let i = 0; i < 4; i++) {
		const x = await call('POST', '/api/auth/register', { email: `u${i}@example.com`, password: 'long enough pw', displayName: `U${i}` });
		reg.push(x.status);
		cookie = '';
	}
	check(reg.slice(0, 3).every((c) => c === 201) && reg[3] === 429, `sign-ups 3..6 -> ${reg.join(',')}`);
	await stop();

	// --- run 2: signup closed, bigger body limit ---------------------------
	await start({ ALLOW_SIGNUP: 'false', BODY_SIZE_LIMIT: '30M' });
	cookie = '';
	r = await call('POST', '/api/auth/register', { email: 'bob@example.com', password: 'long enough pw', displayName: 'Bob' });
	check(r.status === 403, `ALLOW_SIGNUP=false: register -> ${r.status}`);
	r = await call('POST', '/api/auth/login', { email: 'alice@example.com', password: 'correct horse' });
	check(r.status === 200, `ALLOW_SIGNUP=false: existing account signs in -> ${r.status} (limits reset on restart)`);
	const html = await (await fetch(BASE + '/')).text();
	check(/allowSignup:false/.test(html), 'ALLOW_SIGNUP=false reaches the page data');
	r = await call('POST', '/api/projects', big);
	check(r.status === 201 || r.status === 200, `1 MB project body with BODY_SIZE_LIMIT=30M -> ${r.status}`);
	await stop();
} catch (e) {
	console.error(e);
	fails++;
} finally {
	await stop();
	rmSync(DATA, { recursive: true, force: true });
}

console.log(`\nsmoke-hosted: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);

#!/usr/bin/env node
/**
 * Backend smoke test: boots `node build` on a test port pointing at a temp
 * SQLite file, then exercises the auth / project / report endpoints.
 *
 * Usage: node scripts/smoke-backend.mjs
 * Assumes `npm run build` has already produced `build/`.
 */

import { spawn } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');
const PORT = 4175;
const BASE = `http://127.0.0.1:${PORT}`;
const DB_PATH = resolve(root, 'tmp-smoke.db');
const COOKIE_JAR = new Map(); // sessionKey -> { name -> value }
let activeJar = 'default';

function jar() {
	let j = COOKIE_JAR.get(activeJar);
	if (!j) {
		j = new Map();
		COOKIE_JAR.set(activeJar, j);
	}
	return j;
}

function cookieHeader() {
	const j = jar();
	if (!j.size) return '';
	return Array.from(j.entries(), ([k, v]) => `${k}=${v}`).join('; ');
}

function setCookies(res) {
	// Node fetch returns a single 'set-cookie' string with individual cookies
	// separated by ", " — but commas are also valid inside expiry dates. Use
	// the `getSetCookie` accessor where available.
	const raws = typeof res.headers.getSetCookie === 'function'
		? res.headers.getSetCookie()
		: [res.headers.get('set-cookie')].filter(Boolean);
	for (const raw of raws) {
		if (!raw) continue;
		const [pair] = raw.split(';');
		const [name, ...rest] = pair.split('=');
		const value = rest.join('=');
		if (name && value !== undefined) jar().set(name.trim(), value.trim());
	}
}

async function call(method, path, body) {
	const headers = {
		'x-requested-with': 'paramaterial'
	};
	let b;
	if (body !== undefined) {
		headers['content-type'] = 'application/json';
		b = JSON.stringify(body);
	}
	const ck = cookieHeader();
	if (ck) headers.cookie = ck;
	const res = await fetch(BASE + path, { method, headers, body: b });
	setCookies(res);
	let data = null;
	const text = await res.text();
	if (text) {
		try {
			data = JSON.parse(text);
		} catch {
			data = text;
		}
	}
	return { status: res.status, data };
}

function assert(cond, label) {
	if (!cond) {
		console.error(`FAIL: ${label}`);
		process.exit(1);
	}
	console.log(`ok   ${label}`);
}

async function waitForServer(maxMs = 15000) {
	const start = Date.now();
	while (Date.now() - start < maxMs) {
		try {
			const r = await fetch(BASE + '/api/auth/me', { method: 'GET' });
			if (r.status === 401 || r.status === 200) return true;
		} catch {
			/* not yet */
		}
		await delay(200);
	}
	return false;
}

let server;

async function main() {
	// Reset DB from any prior run
	if (existsSync(DB_PATH)) rmSync(DB_PATH);
	const walPath = DB_PATH + '-wal';
	const shmPath = DB_PATH + '-shm';
	for (const p of [walPath, shmPath]) if (existsSync(p)) rmSync(p);

	const env = {
		...process.env,
		PORT: String(PORT),
		HOST: '127.0.0.1',
		ORIGIN: BASE,
		DB_PATH
	};
	server = spawn('node', ['build'], { cwd: root, env, stdio: ['ignore', 'inherit', 'inherit'] });

	const up = await waitForServer();
	if (!up) throw new Error('Server failed to start');

	// --- 1. Register / me / login / logout / me(401) ---
	activeJar = 'user1';
	let r = await call('POST', '/api/auth/register', {
		email: 'alice@example.com',
		password: 'hunter2hunter2',
		displayName: 'Alice'
	});
	assert(r.status === 201 && r.data?.user?.email === 'alice@example.com', 'register alice');

	r = await call('GET', '/api/auth/me');
	assert(r.status === 200 && r.data?.user?.displayName === 'Alice', 'me alice after register');

	// logout, then login
	r = await call('POST', '/api/auth/logout');
	assert(r.status === 204, 'logout alice');

	r = await call('GET', '/api/auth/me');
	assert(r.status === 401, 'me 401 after logout');

	r = await call('POST', '/api/auth/login', {
		email: 'alice@example.com',
		password: 'hunter2hunter2'
	});
	assert(r.status === 200 && r.data?.user?.email === 'alice@example.com', 'login alice');

	r = await call('GET', '/api/auth/me');
	assert(r.status === 200, 'me after login');

	// --- 2. Create project / list / get ---
	r = await call('POST', '/api/projects', { name: 'Alloy study', description: 'Test suite' });
	assert(r.status === 201 && r.data?.project?.id, 'create project');
	const projectId = r.data.project.id;

	r = await call('GET', '/api/projects');
	assert(
		r.status === 200 && Array.isArray(r.data?.projects) && r.data.projects.length === 1,
		'list projects'
	);
	assert(r.data.projects[0].role === 'owner', 'alice is owner');

	r = await call('GET', `/api/projects/${projectId}`);
	assert(
		r.status === 200 && r.data?.project?.name === 'Alloy study',
		'get project'
	);
	assert(Array.isArray(r.data.members) && r.data.members.length === 1, 'project has 1 member');
	assert(Array.isArray(r.data.reports) && r.data.reports.length === 0, 'no reports yet');

	// --- 3. Create report, patch blocks, reload, verify ---
	r = await call('POST', `/api/projects/${projectId}/reports`, { name: 'First report' });
	assert(r.status === 201 && r.data?.report?.id, 'create report');
	const reportId = r.data.report.id;

	const newBlocks = {
		v: 1,
		blocks: [
			{ id: 'a', type: 'note', config: { text: 'hello world' }, createdAt: 111 },
			{ id: 'b', type: 'stress-strain', config: { colorBy: 'temperature' }, createdAt: 222 }
		]
	};
	r = await call('PATCH', `/api/reports/${reportId}`, {
		blocks: newBlocks,
		datasetRef: 'basic-usage'
	});
	assert(r.status === 200, 'patch report');

	r = await call('GET', `/api/reports/${reportId}`);
	assert(r.status === 200, 'get report');
	assert(r.data?.report?.datasetRef === 'basic-usage', 'datasetRef persisted');
	assert(
		Array.isArray(r.data?.report?.blocks?.blocks) && r.data.report.blocks.blocks.length === 2,
		'blocks persisted (2 entries)'
	);
	assert(
		r.data.report.blocks.blocks[0].config.text === 'hello world',
		'block config persisted'
	);

	// --- 4. Register Bob, invite Bob, Bob can list project ---
	activeJar = 'user2';
	r = await call('POST', '/api/auth/register', {
		email: 'bob@example.com',
		password: 'correctbatterystaple',
		displayName: 'Bob'
	});
	assert(r.status === 201, 'register bob');

	// Bob cannot see alice's project yet.
	r = await call('GET', '/api/projects');
	assert(
		r.status === 200 && r.data?.projects?.length === 0,
		'bob sees 0 projects before invite'
	);
	r = await call('GET', `/api/projects/${projectId}`);
	assert(r.status === 403, 'bob gets 403 on project before invite');

	// Back to alice, invite bob.
	activeJar = 'user1';
	r = await call('POST', `/api/projects/${projectId}/members`, {
		email: 'bob@example.com',
		role: 'editor'
	});
	assert(r.status === 201, 'invite bob as editor');

	r = await call('GET', `/api/projects/${projectId}`);
	assert(
		r.data?.members?.some((m) => m.email === 'bob@example.com'),
		'bob in member list'
	);

	// Bob can now list / get.
	activeJar = 'user2';
	r = await call('GET', '/api/projects');
	assert(
		r.status === 200 && r.data?.projects?.length === 1 && r.data.projects[0].role === 'editor',
		'bob lists project with editor role'
	);
	r = await call('GET', `/api/projects/${projectId}`);
	assert(r.status === 200, 'bob gets project');

	// Bob, as editor, can patch the report.
	r = await call('PATCH', `/api/reports/${reportId}`, { name: 'Renamed by Bob' });
	assert(r.status === 200, 'bob renames report');

	activeJar = 'user1';
	r = await call('GET', `/api/reports/${reportId}`);
	assert(r.data?.report?.name === 'Renamed by Bob', 'rename visible to alice');

	// CSRF guard: missing x-requested-with and mismatched origin should 403.
	const plain = await fetch(BASE + `/api/projects`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
		body: JSON.stringify({ name: 'X' })
	});
	assert(plain.status === 403, 'csrf guard rejects cross-origin POST');

	console.log('\nAll smoke-backend checks passed.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exitCode = 1;
	})
	.finally(() => {
		if (server) {
			server.kill('SIGTERM');
			setTimeout(() => server.kill('SIGKILL'), 1000).unref?.();
		}
		// Cleanup temp db
		for (const p of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
			try {
				if (existsSync(p)) rmSync(p);
			} catch {
				/* ignore */
			}
		}
	});

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createReport, listReports, requireRole } from '$lib/server/projects';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Not signed in');
	if (!requireRole(params.id, locals.user.id, 'viewer'))
		throw error(403, 'Not a member of this project');
	return json({
		reports: listReports(params.id).map((r) => ({
			id: r.id,
			name: r.name,
			updatedAt: r.updated_at,
			datasetRef: r.dataset_ref
		}))
	});
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'Not signed in');
	if (!requireRole(params.id, locals.user.id, 'editor'))
		throw error(403, 'editor role required');
	const body = (await request.json().catch(() => ({}))) as {
		name?: string;
		blocks?: unknown;
		chat?: unknown;
		datasetRef?: string | null;
	};
	const name = (body.name ?? '').trim() || 'Untitled report';
	const blocksJson =
		body.blocks !== undefined ? JSON.stringify(body.blocks) : undefined;
	const chatJson = body.chat !== undefined ? JSON.stringify(body.chat) : undefined;
	const report = createReport(params.id, locals.user.id, {
		name,
		blocksJson,
		chatJson,
		datasetRef: body.datasetRef ?? null
	});
	return json({ report }, { status: 201 });
};

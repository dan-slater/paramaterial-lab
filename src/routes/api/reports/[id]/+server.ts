import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	deleteReport,
	getProject,
	getReport,
	getRole,
	requireRole,
	updateReport
} from '$lib/server/projects';

function parseJsonSafe<T>(s: string, fallback: T): T {
	try {
		return JSON.parse(s) as T;
	} catch {
		return fallback;
	}
}

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Not signed in');
	const report = getReport(params.id);
	if (!report) throw error(404, 'Report not found');
	const role = getRole(report.project_id, locals.user.id);
	if (!role) throw error(403, 'Not a member of this project');
	const project = getProject(report.project_id);
	if (!project) throw error(404, 'Project not found');
	return json({
		report: {
			id: report.id,
			projectId: report.project_id,
			name: report.name,
			blocks: parseJsonSafe(report.blocks_json, { v: 1, blocks: [] }),
			chat: parseJsonSafe(report.chat_json, { v: 1, messages: [] }),
			datasetRef: report.dataset_ref,
			createdBy: report.created_by,
			createdAt: report.created_at,
			updatedAt: report.updated_at
		},
		project: {
			id: project.id,
			name: project.name,
			description: project.description,
			ownerId: project.owner_id,
			role
		}
	});
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'Not signed in');
	const report = getReport(params.id);
	if (!report) throw error(404, 'Report not found');
	if (!requireRole(report.project_id, locals.user.id, 'editor'))
		throw error(403, 'editor role required');
	const body = (await request.json().catch(() => ({}))) as {
		name?: string;
		blocks?: unknown;
		chat?: unknown;
		datasetRef?: string | null;
	};
	const patch: {
		name?: string;
		blocksJson?: string;
		chatJson?: string;
		datasetRef?: string | null;
	} = {};
	if (typeof body.name === 'string') {
		const n = body.name.trim();
		if (!n) throw error(400, 'name cannot be empty');
		patch.name = n;
	}
	if (body.blocks !== undefined) patch.blocksJson = JSON.stringify(body.blocks);
	if (body.chat !== undefined) patch.chatJson = JSON.stringify(body.chat);
	if (body.datasetRef !== undefined) patch.datasetRef = body.datasetRef;
	updateReport(params.id, patch);
	return json({ ok: true, updatedAt: Date.now() });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Not signed in');
	const report = getReport(params.id);
	if (!report) throw error(404, 'Report not found');
	const project = getProject(report.project_id);
	if (!project) throw error(404, 'Project not found');
	const isCreator = report.created_by === locals.user.id;
	const isOwner = project.owner_id === locals.user.id;
	if (!isCreator && !isOwner) throw error(403, 'Only owner or creator can delete');
	deleteReport(params.id);
	return new Response(null, { status: 204 });
};

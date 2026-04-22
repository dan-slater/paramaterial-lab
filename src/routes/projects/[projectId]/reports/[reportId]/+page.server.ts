import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProject, getReport, getRole } from '$lib/server/projects';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/');
	const report = getReport(params.reportId);
	if (!report) throw error(404, 'Report not found');
	if (report.project_id !== params.projectId) throw error(404, 'Report not found in this project');
	const role = getRole(report.project_id, locals.user.id);
	if (!role) throw error(403, 'Not a member of this project');
	const project = getProject(report.project_id);
	if (!project) throw error(404, 'Project not found');

	let blocks: unknown = { v: 1, blocks: [] };
	let chat: unknown = { v: 1, messages: [] };
	try {
		blocks = JSON.parse(report.blocks_json);
	} catch {
		/* fall through */
	}
	try {
		chat = JSON.parse(report.chat_json);
	} catch {
		/* fall through */
	}
	return {
		report: {
			id: report.id,
			name: report.name,
			blocks,
			chat,
			datasetRef: report.dataset_ref,
			createdBy: report.created_by,
			createdAt: report.created_at,
			updatedAt: report.updated_at
		},
		project: {
			id: project.id,
			name: project.name,
			role
		}
	};
};

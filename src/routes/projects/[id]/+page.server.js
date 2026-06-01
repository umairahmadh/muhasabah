import { error, fail, redirect } from '@sveltejs/kit';
import {
	getProject,
	listTasks,
	createTask,
	toggleTask,
	toggleStar,
	deleteTask,
	setProjectStatus,
	deleteProject
} from '$lib/server/db.js';

export function load({ params, locals }) {
	const project = getProject(locals.user.id, Number(params.id));
	if (!project) throw error(404, 'No such project');
	return { project, tasks: listTasks(locals.user.id, project.id) };
}

export const actions = {
	addTask: async ({ request, params, locals }) => {
		const data = await request.formData();
		const title = String(data.get('title') ?? '').trim();
		if (!title) return fail(400, { error: 'Empty task.' });
		createTask(locals.user.id, Number(params.id), title);
		return { ok: true };
	},
	toggle: async ({ request, locals }) => {
		const data = await request.formData();
		toggleTask(locals.user.id, Number(data.get('id')));
		return { ok: true };
	},
	star: async ({ request, locals }) => {
		const data = await request.formData();
		toggleStar(locals.user.id, Number(data.get('id')));
		return { ok: true };
	},
	removeTask: async ({ request, locals }) => {
		const data = await request.formData();
		deleteTask(locals.user.id, Number(data.get('id')));
		return { ok: true };
	},
	setStatus: async ({ request, params, locals }) => {
		const data = await request.formData();
		setProjectStatus(locals.user.id, Number(params.id), String(data.get('status')));
		return { ok: true };
	},
	removeProject: async ({ params, locals }) => {
		deleteProject(locals.user.id, Number(params.id));
		throw redirect(303, '/');
	}
};

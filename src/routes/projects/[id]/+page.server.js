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

export function load({ params }) {
	const project = getProject(Number(params.id));
	if (!project) throw error(404, 'No such project');
	return { project, tasks: listTasks(project.id) };
}

export const actions = {
	addTask: async ({ request, params }) => {
		const data = await request.formData();
		const title = String(data.get('title') ?? '').trim();
		if (!title) return fail(400, { error: 'Empty task.' });
		createTask(Number(params.id), title);
		return { ok: true };
	},
	toggle: async ({ request }) => {
		const data = await request.formData();
		toggleTask(Number(data.get('id')));
		return { ok: true };
	},
	star: async ({ request }) => {
		const data = await request.formData();
		toggleStar(Number(data.get('id')));
		return { ok: true };
	},
	removeTask: async ({ request }) => {
		const data = await request.formData();
		deleteTask(Number(data.get('id')));
		return { ok: true };
	},
	setStatus: async ({ request, params }) => {
		const data = await request.formData();
		setProjectStatus(Number(params.id), String(data.get('status')));
		return { ok: true };
	},
	removeProject: async ({ params }) => {
		deleteProject(Number(params.id));
		throw redirect(303, '/');
	}
};

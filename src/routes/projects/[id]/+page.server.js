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

export async function load({ params }) {
	const project = await getProject(Number(params.id));
	if (!project) throw error(404, 'No such project');
	return { project, tasks: await listTasks(project.id) };
}

export const actions = {
	addTask: async ({ request, params }) => {
		const data = await request.formData();
		const title = String(data.get('title') ?? '').trim();
		if (!title) return fail(400, { error: 'Empty task.' });
		await createTask(Number(params.id), title);
		return { ok: true };
	},
	toggle: async ({ request }) => {
		const data = await request.formData();
		await toggleTask(Number(data.get('id')));
		return { ok: true };
	},
	star: async ({ request }) => {
		const data = await request.formData();
		await toggleStar(Number(data.get('id')));
		return { ok: true };
	},
	removeTask: async ({ request }) => {
		const data = await request.formData();
		await deleteTask(Number(data.get('id')));
		return { ok: true };
	},
	setStatus: async ({ request, params }) => {
		const data = await request.formData();
		await setProjectStatus(Number(params.id), String(data.get('status')));
		return { ok: true };
	},
	removeProject: async ({ params }) => {
		await deleteProject(Number(params.id));
		throw redirect(303, '/');
	}
};

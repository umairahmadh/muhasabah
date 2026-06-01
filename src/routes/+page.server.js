import { fail, redirect } from '@sveltejs/kit';
import { COOKIE } from '$lib/server/auth.js';
import { listProjects, statusCounts, createProject } from '$lib/server/db.js';

export async function load() {
	return {
		projects: await listProjects('active'),
		counts: await statusCounts()
	};
}

export const actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Give it a name.' });
		const color = String(data.get('color') ?? '#6ea8fe');
		await createProject(name, '', color);
		return { created: true };
	},

	logout: async ({ cookies }) => {
		cookies.delete(COOKIE, { path: '/' });
		throw redirect(303, '/login');
	}
};

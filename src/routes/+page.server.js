import { fail, redirect } from '@sveltejs/kit';
import { COOKIE } from '$lib/server/auth.js';
import { listProjects, statusCounts, createProject } from '$lib/server/db.js';

export function load({ locals }) {
	return {
		email: locals.user.email,
		projects: listProjects(locals.user.id, 'active'),
		counts: statusCounts(locals.user.id)
	};
}

export const actions = {
	create: async ({ request, locals }) => {
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Give it a name.' });
		const color = String(data.get('color') ?? '#6ea8fe');
		createProject(locals.user.id, name, '', color);
		return { created: true };
	},

	logout: async ({ cookies }) => {
		cookies.delete(COOKIE, { path: '/' });
		throw redirect(303, '/login');
	}
};

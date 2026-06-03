import { fail, redirect } from '@sveltejs/kit';
import { COOKIE } from '$lib/server/auth.js';
import {
	listProjects,
	statusCounts,
	createProject,
	reorderProjects,
	listHabits,
	toggleHabitLog
} from '$lib/server/db.js';

export async function load() {
	const today = (() => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	})();

	return {
		projects: await listProjects('active'),
		counts: await statusCounts(),
		habits: await listHabits(),
		today
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

	reorder: async ({ request }) => {
		const data = await request.formData();
		const raw = String(data.get('ids') ?? '');
		const ids = raw
			.split(',')
			.map((s) => Number(s.trim()))
			.filter(Boolean);
		if (ids.length) await reorderProjects(ids);
		return { ok: true };
	},

	habitToggle: async ({ request }) => {
		const data = await request.formData();
		await toggleHabitLog(Number(data.get('id')), String(data.get('date')));
		return { ok: true };
	},

	logout: async ({ cookies }) => {
		cookies.delete(COOKIE, { path: '/' });
		throw redirect(303, '/login');
	}
};

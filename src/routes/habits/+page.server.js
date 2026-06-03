import { fail } from '@sveltejs/kit';
import { listHabits, createHabit, deleteHabit, toggleHabitLog, getHabitHistory } from '$lib/server/db.js';

export async function load() {
	const habits = await listHabits();

	// Attach last-60-day history to each habit for the grid view
	const withHistory = await Promise.all(
		habits.map(async (h) => ({
			...h,
			history: await getHabitHistory(h.id, 60)
		}))
	);

	const today = (() => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	})();

	return { habits: withHistory, today };
}

export const actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Give the habit a name.' });
		const recurrence = String(data.get('recurrence') ?? 'daily');
		if (!['daily', 'weekly', 'monthly'].includes(recurrence))
			return fail(400, { error: 'Invalid recurrence.' });
		await createHabit(name, recurrence);
		return { created: true };
	},

	remove: async ({ request }) => {
		const data = await request.formData();
		await deleteHabit(Number(data.get('id')));
		return { ok: true };
	},

	toggle: async ({ request }) => {
		const data = await request.formData();
		await toggleHabitLog(Number(data.get('id')), String(data.get('date')));
		return { ok: true };
	}
};

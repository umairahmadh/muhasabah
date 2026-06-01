import { fail, redirect } from '@sveltejs/kit';
import { COOKIE, verifyPassword, makeSessionToken } from '$lib/server/auth.js';
import { getUserByEmail } from '$lib/server/db.js';

export const actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '').trim().toLowerCase();
		const password = String(data.get('password') ?? '');

		const user = getUserByEmail(email);
		if (!user || !verifyPassword(password, user.password_hash)) {
			return fail(401, { email, error: 'Wrong email or password.' });
		}

		cookies.set(COOKIE, makeSessionToken(user.id), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
		throw redirect(303, '/');
	}
};

import { fail, redirect } from '@sveltejs/kit';
import { COOKIE, hashPassword, makeSessionToken, validEmail } from '$lib/server/auth.js';
import { createUser, getUserByEmail } from '$lib/server/db.js';

export const actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = String(data.get('email') ?? '').trim().toLowerCase();
		const password = String(data.get('password') ?? '');

		if (!validEmail(email)) return fail(400, { email, error: 'Enter a valid email.' });
		if (password.length < 8) return fail(400, { email, error: 'Password needs at least 8 characters.' });
		if (getUserByEmail(email)) return fail(409, { email, error: 'That email is already registered.' });

		const id = createUser(email, hashPassword(password));

		cookies.set(COOKIE, makeSessionToken(id), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
		throw redirect(303, '/');
	}
};

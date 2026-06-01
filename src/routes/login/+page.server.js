import { fail, redirect } from '@sveltejs/kit';
import { COOKIE, checkPassword, makeToken } from '$lib/server/auth.js';

export const actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		if (!checkPassword(data.get('password'))) {
			return fail(401, { error: 'Wrong password.' });
		}
		cookies.set(COOKIE, await makeToken(), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
		throw redirect(303, '/');
	}
};

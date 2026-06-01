import { redirect } from '@sveltejs/kit';
import { COOKIE, isValidToken } from '$lib/server/auth.js';

export async function handle({ event, resolve }) {
	const authed = isValidToken(event.cookies.get(COOKIE));
	event.locals.authed = authed;

	const path = event.url.pathname;
	const isLogin = path === '/login';

	if (!authed && !isLogin) throw redirect(303, '/login');
	if (authed && isLogin) throw redirect(303, '/');

	return resolve(event);
}

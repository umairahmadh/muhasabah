import { redirect } from '@sveltejs/kit';
import { COOKIE, isValidToken } from '$lib/server/auth.js';

const PUBLIC = new Set(['/login']);

export async function handle({ event, resolve }) {
	const authed = await isValidToken(event.cookies.get(COOKIE));
	event.locals.authed = authed;

	const isPublic = PUBLIC.has(event.url.pathname);
	if (!authed && !isPublic) throw redirect(303, '/login');
	if (authed && isPublic) throw redirect(303, '/');

	return resolve(event);
}

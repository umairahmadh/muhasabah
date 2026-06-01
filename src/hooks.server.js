import { redirect } from '@sveltejs/kit';
import { COOKIE, parseSessionToken } from '$lib/server/auth.js';
import { getUserById } from '$lib/server/db.js';

const PUBLIC = new Set(['/login', '/signup']);

export async function handle({ event, resolve }) {
	const userId = parseSessionToken(event.cookies.get(COOKIE));
	const user = userId ? getUserById(userId) : null;
	event.locals.user = user ?? null;

	const isPublic = PUBLIC.has(event.url.pathname);
	if (!user && !isPublic) throw redirect(303, '/login');
	if (user && isPublic) throw redirect(303, '/');

	return resolve(event);
}

// Single-user auth. No accounts, no users table — one password from env.
// Session cookie: "userId.HMAC(secret, password)" — stateless signed token.
// getSessionSecret() is async (DB call), so all functions here are async.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { getSessionSecret } from './db.js';

export const COOKIE = 'muhasabah_session';

function password() {
	return process.env.MUHASABAH_PASSWORD || 'muhasabah';
}

async function expectedToken() {
	const secret = await getSessionSecret();
	return createHmac('sha256', secret).update(password()).digest('hex');
}

export function checkPassword(input) {
	const a = Buffer.from(String(input ?? ''));
	const b = Buffer.from(password());
	return a.length === b.length && timingSafeEqual(a, b);
}

export async function makeToken() {
	return expectedToken();
}

export async function isValidToken(token) {
	if (!token) return false;
	const expected = await expectedToken();
	const a = Buffer.from(token);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

// Single-user auth. No accounts, no users table — one password from env.
// The session cookie holds an HMAC token derived from the server secret;
// we just check it equals the expected token. That's the whole system.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { getSessionSecret } from './db.js';

export const COOKIE = 'muhasabah_session';

function password() {
	return process.env.MUHASABAH_PASSWORD || 'muhasabah';
}

function expectedToken() {
	return createHmac('sha256', getSessionSecret()).update(password()).digest('hex');
}

export function checkPassword(input) {
	const a = Buffer.from(String(input ?? ''));
	const b = Buffer.from(password());
	return a.length === b.length && timingSafeEqual(a, b);
}

export function makeToken() {
	return expectedToken();
}

export function isValidToken(token) {
	if (!token) return false;
	const a = Buffer.from(token);
	const b = Buffer.from(expectedToken());
	return a.length === b.length && timingSafeEqual(a, b);
}

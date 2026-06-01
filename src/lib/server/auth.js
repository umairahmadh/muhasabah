// Multi-user auth, kept deliberately small.
//
// Passwords: scrypt with a per-user random salt, stored as "salt:hash".
// Sessions: a stateless signed cookie "userId.HMAC(userId)" — no sessions
// table. parseSessionToken returns the user id only if the signature checks.

import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { getSessionSecret } from './db.js';

export const COOKIE = 'muhasabah_session';

export function hashPassword(pw) {
	const salt = randomBytes(16).toString('hex');
	const hash = scryptSync(pw, salt, 64).toString('hex');
	return `${salt}:${hash}`;
}

export function verifyPassword(pw, stored) {
	const [salt, hash] = String(stored).split(':');
	if (!salt || !hash) return false;
	const a = scryptSync(pw, salt, 64);
	const b = Buffer.from(hash, 'hex');
	return a.length === b.length && timingSafeEqual(a, b);
}

function sign(value) {
	return createHmac('sha256', getSessionSecret()).update(value).digest('hex');
}

export function makeSessionToken(userId) {
	const v = String(userId);
	return `${v}.${sign(v)}`;
}

export function parseSessionToken(token) {
	if (!token) return null;
	const dot = token.lastIndexOf('.');
	if (dot < 0) return null;
	const value = token.slice(0, dot);
	const sig = token.slice(dot + 1);
	const expected = sign(value);
	const a = Buffer.from(sig);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
	const id = Number(value);
	return Number.isInteger(id) ? id : null;
}

export function validEmail(email) {
	return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email ?? ''));
}

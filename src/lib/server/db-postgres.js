// Postgres adapter — used when DATABASE_URL is set (e.g. Neon).
// Uses the `postgres` npm package (tagged-template API, auto-parameterized).
// Schema is created on first load via top-level await.

import postgres from 'postgres';
import { randomBytes } from 'node:crypto';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

await sql.unsafe(`
	CREATE TABLE IF NOT EXISTS meta (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS projects (
		id              SERIAL PRIMARY KEY,
		name            TEXT NOT NULL,
		note            TEXT NOT NULL DEFAULT '',
		status          TEXT NOT NULL DEFAULT 'active',
		color           TEXT NOT NULL DEFAULT '#6ea8fe',
		created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		last_touched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS tasks (
		id          SERIAL PRIMARY KEY,
		project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
		title       TEXT NOT NULL,
		done        BOOLEAN NOT NULL DEFAULT FALSE,
		starred     BOOLEAN NOT NULL DEFAULT FALSE,
		position    INTEGER NOT NULL DEFAULT 0,
		created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		done_at     TIMESTAMPTZ
	);

	CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
`);

// --- meta ------------------------------------------------------------------

export async function getSessionSecret() {
	const rows = await sql`SELECT value FROM meta WHERE key = 'session_secret'`;
	if (rows.length) return rows[0].value;
	const secret = randomBytes(32).toString('hex');
	// ON CONFLICT guards against race conditions (unlikely for personal app, but correct)
	await sql`INSERT INTO meta (key, value) VALUES ('session_secret', ${secret}) ON CONFLICT (key) DO NOTHING`;
	const [row] = await sql`SELECT value FROM meta WHERE key = 'session_secret'`;
	return row.value;
}

// --- projects --------------------------------------------------------------

export async function listProjects(status = 'active') {
	const projects = await sql`
		SELECT * FROM projects WHERE status = ${status} ORDER BY last_touched_at ASC`;

	return Promise.all(projects.map(async (p) => {
		const [{ n: total }]     = await sql`SELECT COUNT(*)::int n FROM tasks WHERE project_id = ${p.id}`;
		const [{ n: done }]      = await sql`SELECT COUNT(*)::int n FROM tasks WHERE project_id = ${p.id} AND done = TRUE`;
		const [{ n: doneToday }] = await sql`SELECT COUNT(*)::int n FROM tasks WHERE project_id = ${p.id} AND done = TRUE AND done_at::date = CURRENT_DATE`;
		const [{ n: hot }]       = await sql`SELECT COUNT(*)::int n FROM tasks WHERE project_id = ${p.id} AND done = FALSE AND starred = TRUE`;
		const next               = await sql`SELECT title FROM tasks WHERE project_id = ${p.id} AND done = FALSE ORDER BY starred DESC, position ASC, created_at ASC LIMIT 3`;

		return { ...p, total, done, doneToday, hot, next: next.map((t) => t.title) };
	}));
}

export async function statusCounts() {
	const rows = await sql`SELECT status, COUNT(*)::int n FROM projects GROUP BY status`;
	const out = { active: 0, backlog: 0, done: 0, dropped: 0 };
	for (const r of rows) out[r.status] = r.n;
	return out;
}

export async function createProject(name, note = '', color = '#6ea8fe') {
	const [{ id }] = await sql`INSERT INTO projects (name, note, color) VALUES (${name}, ${note}, ${color}) RETURNING id`;
	return id;
}

export async function getProject(id) {
	const [row] = await sql`SELECT * FROM projects WHERE id = ${id}`;
	return row ?? null;
}

export async function setProjectStatus(id, status) {
	await sql`UPDATE projects SET status = ${status}, last_touched_at = NOW() WHERE id = ${id}`;
}

async function touchProject(id) {
	await sql`UPDATE projects SET last_touched_at = NOW() WHERE id = ${id}`;
}

export async function deleteProject(id) {
	await sql`DELETE FROM projects WHERE id = ${id}`;
}

// --- tasks -----------------------------------------------------------------

export async function listTasks(projectId) {
	return sql`
		SELECT * FROM tasks WHERE project_id = ${projectId}
		ORDER BY done ASC, starred DESC, position ASC, created_at ASC`;
}

export async function createTask(projectId, title) {
	const [{ m }] = await sql`SELECT COALESCE(MAX(position), 0)::int m FROM tasks WHERE project_id = ${projectId}`;
	const [{ id }] = await sql`
		INSERT INTO tasks (project_id, title, position) VALUES (${projectId}, ${title}, ${m + 1}) RETURNING id`;
	await touchProject(projectId);
	return id;
}

export async function toggleTask(id) {
	const [t] = await sql`SELECT done, project_id FROM tasks WHERE id = ${id}`;
	if (!t) return;
	const nowDone = !t.done;
	await sql`UPDATE tasks SET done = ${nowDone}, done_at = ${nowDone ? new Date() : null} WHERE id = ${id}`;
	await touchProject(t.project_id);
}

export async function toggleStar(id) {
	const [t] = await sql`SELECT starred, project_id FROM tasks WHERE id = ${id}`;
	if (!t) return;
	await sql`UPDATE tasks SET starred = ${!t.starred} WHERE id = ${id}`;
	await touchProject(t.project_id);
}

export async function deleteTask(id) {
	const [t] = await sql`SELECT project_id FROM tasks WHERE id = ${id}`;
	await sql`DELETE FROM tasks WHERE id = ${id}`;
	if (t) await touchProject(t.project_id);
}

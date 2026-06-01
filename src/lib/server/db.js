// The ONLY place that touches the database driver.
//
// The rest of the app imports the named query functions below and never
// sees `better-sqlite3`. That is the whole "decide later" insurance: to move
// to Turso/libSQL one day you reimplement this file and nothing else changes.
// Rule: keep the SQL plain SQLite. No Postgres-isms, no ORM, no extensions.

import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';

const DB_PATH = process.env.MUHASABAH_DB || './muhasabah.db';

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
	CREATE TABLE IF NOT EXISTS meta (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS projects (
		id              INTEGER PRIMARY KEY,
		name            TEXT NOT NULL,
		note            TEXT NOT NULL DEFAULT '',
		status          TEXT NOT NULL DEFAULT 'active',   -- active | backlog | done | dropped
		color           TEXT NOT NULL DEFAULT '#6ea8fe',
		created_at      TEXT NOT NULL DEFAULT (datetime('now')),
		last_touched_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS tasks (
		id          INTEGER PRIMARY KEY,
		project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
		title       TEXT NOT NULL,
		done        INTEGER NOT NULL DEFAULT 0,
		starred     INTEGER NOT NULL DEFAULT 0,
		position    INTEGER NOT NULL DEFAULT 0,
		created_at  TEXT NOT NULL DEFAULT (datetime('now')),
		done_at     TEXT
	);

	CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
`);

// --- meta -----------------------------------------------------------------

export function getSessionSecret() {
	const row = db.prepare(`SELECT value FROM meta WHERE key = 'session_secret'`).get();
	if (row) return row.value;
	const secret = randomBytes(32).toString('hex');
	db.prepare(`INSERT INTO meta (key, value) VALUES ('session_secret', ?)`).run(secret);
	return secret;
}

// --- projects --------------------------------------------------------------

// Each project carries a small summary the Wall can render without a tap:
// progress, the next few open tasks, today's tick count, a hot count.
export function listProjects(status = 'active') {
	const projects = db
		.prepare(`SELECT * FROM projects WHERE status = ? ORDER BY last_touched_at ASC`)
		.all(status);

	const total = db.prepare(`SELECT COUNT(*) n FROM tasks WHERE project_id = ?`);
	const doneCount = db.prepare(`SELECT COUNT(*) n FROM tasks WHERE project_id = ? AND done = 1`);
	const doneToday = db.prepare(
		`SELECT COUNT(*) n FROM tasks WHERE project_id = ? AND done = 1 AND date(done_at) = date('now','localtime')`
	);
	const hot = db.prepare(`SELECT COUNT(*) n FROM tasks WHERE project_id = ? AND done = 0 AND starred = 1`);
	const nextTasks = db.prepare(
		`SELECT title FROM tasks WHERE project_id = ? AND done = 0
		 ORDER BY starred DESC, position ASC, created_at ASC LIMIT 3`
	);

	return projects.map((p) => ({
		...p,
		total: total.get(p.id).n,
		done: doneCount.get(p.id).n,
		doneToday: doneToday.get(p.id).n,
		hot: hot.get(p.id).n,
		next: nextTasks.all(p.id).map((t) => t.title)
	}));
}

export function statusCounts() {
	const rows = db.prepare(`SELECT status, COUNT(*) n FROM projects GROUP BY status`).all();
	const out = { active: 0, backlog: 0, done: 0, dropped: 0 };
	for (const r of rows) out[r.status] = r.n;
	return out;
}

export function createProject(name, note = '', color = '#6ea8fe') {
	return db
		.prepare(`INSERT INTO projects (name, note, color) VALUES (?, ?, ?)`)
		.run(name, note, color).lastInsertRowid;
}

export function getProject(id) {
	return db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id);
}

export function setProjectStatus(id, status) {
	db.prepare(`UPDATE projects SET status = ? WHERE id = ?`).run(status, id);
	touchProject(id);
}

export function touchProject(id) {
	db.prepare(`UPDATE projects SET last_touched_at = datetime('now') WHERE id = ?`).run(id);
}

export function deleteProject(id) {
	db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
}

// --- tasks -----------------------------------------------------------------

export function listTasks(projectId) {
	return db
		.prepare(
			`SELECT * FROM tasks WHERE project_id = ?
			 ORDER BY done ASC, starred DESC, position ASC, created_at ASC`
		)
		.all(projectId);
}

export function createTask(projectId, title) {
	const max = db.prepare(`SELECT COALESCE(MAX(position), 0) m FROM tasks WHERE project_id = ?`).get(projectId).m;
	const id = db
		.prepare(`INSERT INTO tasks (project_id, title, position) VALUES (?, ?, ?)`)
		.run(projectId, title, max + 1).lastInsertRowid;
	touchProject(projectId);
	return id;
}

export function toggleTask(id) {
	const t = db.prepare(`SELECT done, project_id FROM tasks WHERE id = ?`).get(id);
	if (!t) return;
	const nowDone = t.done ? 0 : 1;
	db.prepare(`UPDATE tasks SET done = ?, done_at = ? WHERE id = ?`).run(
		nowDone,
		nowDone ? new Date().toISOString() : null,
		id
	);
	touchProject(t.project_id);
}

export function toggleStar(id) {
	const t = db.prepare(`SELECT starred, project_id FROM tasks WHERE id = ?`).get(id);
	if (!t) return;
	db.prepare(`UPDATE tasks SET starred = ? WHERE id = ?`).run(t.starred ? 0 : 1, id);
	touchProject(t.project_id);
}

export function deleteTask(id) {
	const t = db.prepare(`SELECT project_id FROM tasks WHERE id = ?`).get(id);
	db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id);
	if (t) touchProject(t.project_id);
}

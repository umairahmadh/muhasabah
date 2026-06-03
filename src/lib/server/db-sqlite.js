// SQLite adapter — used when DATABASE_URL is NOT set.
// All exports are async (same interface as db-postgres.js) even though
// better-sqlite3 is synchronous underneath.

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
		status          TEXT NOT NULL DEFAULT 'active',
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

	CREATE TABLE IF NOT EXISTS habits (
		id               INTEGER PRIMARY KEY,
		name             TEXT NOT NULL,
		recurrence       TEXT NOT NULL DEFAULT 'daily',
		recurrence_value INTEGER,
		created_at       TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS habit_logs (
		id         INTEGER PRIMARY KEY,
		habit_id   INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
		log_date   TEXT NOT NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		UNIQUE(habit_id, log_date)
	);

	CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
	CREATE INDEX IF NOT EXISTS idx_habit_logs ON habit_logs(habit_id, log_date DESC);
`);

// Schema migrations for columns added after initial release
function addColIfMissing(table, col, def) {
	const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
	if (!exists) db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`).run();
}
addColIfMissing('projects', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');
addColIfMissing('tasks', 'recurrence', 'TEXT');
addColIfMissing('tasks', 'recurrence_days', 'INTEGER');
addColIfMissing('tasks', 'next_due', 'TEXT');

// --- helpers ---------------------------------------------------------------

function localDateStr() {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, n) {
	const d = new Date(dateStr + 'T12:00:00');
	d.setDate(d.getDate() + n);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateDiffDays(from, to) {
	const a = new Date(from + 'T00:00:00');
	const b = new Date(to + 'T00:00:00');
	return Math.round((b - a) / 86_400_000);
}

function recurrenceDays(recurrence, customDays) {
	if (recurrence === 'daily') return 1;
	if (recurrence === 'weekly') return 7;
	if (recurrence === 'monthly') return 30;
	return Math.max(1, customDays || 7);
}

function habitStats(habit, logs, today) {
	const logDates = new Set(logs.map((l) => l.log_date));
	const doneToday = logDates.has(today);
	const lastDone = logs[0]?.log_date ?? null; // most recent (DESC order)

	const refDate = lastDone ?? habit.created_at.slice(0, 10);
	const daysSince = dateDiffDays(refDate, today);

	let missCount = 0;
	if (!doneToday) {
		if (habit.recurrence === 'daily') {
			// subtract 1: today is still pending, not missed
			missCount = Math.max(0, daysSince - 1);
		} else if (habit.recurrence === 'weekly') {
			missCount = Math.floor(daysSince / 7);
		} else {
			// monthly
			missCount = Math.floor(daysSince / 30);
		}
	}

	return { doneToday, missCount, lastDone };
}

// --- meta ------------------------------------------------------------------

export async function getSessionSecret() {
	const row = db.prepare(`SELECT value FROM meta WHERE key = 'session_secret'`).get();
	if (row) return row.value;
	const secret = randomBytes(32).toString('hex');
	db.prepare(`INSERT INTO meta (key, value) VALUES ('session_secret', ?)`).run(secret);
	return secret;
}

// --- projects --------------------------------------------------------------

export async function listProjects(status = 'active') {
	const projects = db
		.prepare(
			`SELECT * FROM projects WHERE status = ? ORDER BY sort_order ASC, last_touched_at ASC`
		)
		.all(status);

	const total     = db.prepare(`SELECT COUNT(*) n FROM tasks WHERE project_id = ? AND (recurrence IS NULL OR next_due IS NULL OR next_due <= date('now','localtime'))`);
	const doneCount = db.prepare(`SELECT COUNT(*) n FROM tasks WHERE project_id = ? AND done = 1 AND recurrence IS NULL`);
	const doneToday = db.prepare(`SELECT COUNT(*) n FROM tasks WHERE project_id = ? AND done = 1 AND recurrence IS NULL AND date(done_at) = date('now','localtime')`);
	const hot       = db.prepare(`SELECT COUNT(*) n FROM tasks WHERE project_id = ? AND done = 0 AND starred = 1 AND (next_due IS NULL OR next_due <= date('now','localtime'))`);
	const nextTasks = db.prepare(`SELECT title FROM tasks WHERE project_id = ? AND done = 0 AND (next_due IS NULL OR next_due <= date('now','localtime')) ORDER BY starred DESC, position ASC, created_at ASC LIMIT 3`);

	return projects.map((p) => ({
		...p,
		total:     total.get(p.id).n,
		done:      doneCount.get(p.id).n,
		doneToday: doneToday.get(p.id).n,
		hot:       hot.get(p.id).n,
		next:      nextTasks.all(p.id).map((t) => t.title)
	}));
}

export async function statusCounts() {
	const rows = db.prepare(`SELECT status, COUNT(*) n FROM projects GROUP BY status`).all();
	const out = { active: 0, backlog: 0, done: 0, dropped: 0 };
	for (const r of rows) out[r.status] = r.n;
	return out;
}

export async function createProject(name, note = '', color = '#6ea8fe') {
	const maxOrder = db.prepare(`SELECT COALESCE(MAX(sort_order), -1) m FROM projects WHERE status = 'active'`).get().m;
	return db
		.prepare(`INSERT INTO projects (name, note, color, sort_order) VALUES (?, ?, ?, ?)`)
		.run(name, note, color, maxOrder + 1).lastInsertRowid;
}

export async function getProject(id) {
	return db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id);
}

export async function setProjectStatus(id, status) {
	db.prepare(`UPDATE projects SET status = ?, last_touched_at = datetime('now') WHERE id = ?`).run(status, id);
}

function touchProject(id) {
	db.prepare(`UPDATE projects SET last_touched_at = datetime('now') WHERE id = ?`).run(id);
}

export async function deleteProject(id) {
	db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
}

export async function reorderProjects(ids) {
	const stmt = db.prepare(`UPDATE projects SET sort_order = ? WHERE id = ?`);
	db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))();
}

// --- tasks -----------------------------------------------------------------

export async function listTasks(projectId) {
	return db.prepare(`
		SELECT * FROM tasks WHERE project_id = ?
		ORDER BY
			CASE
				WHEN done = 1 AND recurrence IS NULL THEN 3
				WHEN recurrence IS NOT NULL AND next_due IS NOT NULL AND next_due > date('now','localtime') THEN 2
				ELSE 1
			END ASC,
			starred DESC, position ASC, created_at ASC
	`).all(projectId);
}

export async function createTask(projectId, title, recurrence = null, recurrenceDaysParam = null) {
	const max = db
		.prepare(`SELECT COALESCE(MAX(position), 0) m FROM tasks WHERE project_id = ?`)
		.get(projectId).m;
	const id = db
		.prepare(
			`INSERT INTO tasks (project_id, title, position, recurrence, recurrence_days) VALUES (?, ?, ?, ?, ?)`
		)
		.run(projectId, title, max + 1, recurrence || null, recurrenceDaysParam || null)
		.lastInsertRowid;
	touchProject(projectId);
	return id;
}

export async function toggleTask(id) {
	const t = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
	if (!t) return;

	if (t.recurrence) {
		const today = localDateStr();
		if (t.next_due && t.next_due > today) {
			// Snoozed → un-snooze (bring back now)
			db.prepare(`UPDATE tasks SET next_due = NULL WHERE id = ?`).run(id);
		} else {
			// Due → snooze until next recurrence
			const days = recurrenceDays(t.recurrence, t.recurrence_days);
			const nextDue = addDays(today, days);
			db.prepare(`UPDATE tasks SET next_due = ?, done_at = datetime('now') WHERE id = ?`).run(
				nextDue,
				id
			);
		}
		touchProject(t.project_id);
		return;
	}

	const nowDone = t.done ? 0 : 1;
	db.prepare(`UPDATE tasks SET done = ?, done_at = ? WHERE id = ?`).run(
		nowDone,
		nowDone ? new Date().toISOString() : null,
		id
	);
	touchProject(t.project_id);
}

export async function toggleStar(id) {
	const t = db.prepare(`SELECT starred, project_id FROM tasks WHERE id = ?`).get(id);
	if (!t) return;
	db.prepare(`UPDATE tasks SET starred = ? WHERE id = ?`).run(t.starred ? 0 : 1, id);
	touchProject(t.project_id);
}

export async function deleteTask(id) {
	const t = db.prepare(`SELECT project_id FROM tasks WHERE id = ?`).get(id);
	db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id);
	if (t) touchProject(t.project_id);
}

// --- habits ----------------------------------------------------------------

export async function listHabits() {
	const habits = db.prepare(`SELECT * FROM habits ORDER BY id ASC`).all();
	const today = localDateStr();

	return habits.map((h) => {
		const logs = db
			.prepare(
				`SELECT log_date FROM habit_logs WHERE habit_id = ? ORDER BY log_date DESC LIMIT 365`
			)
			.all(h.id);
		return { ...h, ...habitStats(h, logs, today) };
	});
}

export async function createHabit(name, recurrence, recurrenceValue = null) {
	return db
		.prepare(`INSERT INTO habits (name, recurrence, recurrence_value) VALUES (?, ?, ?)`)
		.run(name, recurrence, recurrenceValue ?? null).lastInsertRowid;
}

export async function deleteHabit(id) {
	db.prepare(`DELETE FROM habits WHERE id = ?`).run(id);
}

export async function toggleHabitLog(habitId, date) {
	const existing = db
		.prepare(`SELECT id FROM habit_logs WHERE habit_id = ? AND log_date = ?`)
		.get(habitId, date);
	if (existing) {
		db.prepare(`DELETE FROM habit_logs WHERE habit_id = ? AND log_date = ?`).run(habitId, date);
		return false;
	} else {
		db.prepare(`INSERT INTO habit_logs (habit_id, log_date) VALUES (?, ?)`).run(habitId, date);
		return true;
	}
}

export async function getHabitHistory(habitId, days = 60) {
	const today = localDateStr();
	const from = addDays(today, -days);
	return db
		.prepare(
			`SELECT log_date FROM habit_logs WHERE habit_id = ? AND log_date >= ? ORDER BY log_date DESC`
		)
		.all(habitId, from)
		.map((r) => r.log_date);
}

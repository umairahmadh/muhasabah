// Postgres adapter — used when DATABASE_URL is set (e.g. Neon).
// Uses the `postgres` npm package (tagged-template API, auto-parameterized).
// Schema is created on first load via top-level await.

import postgres from 'postgres';
import { randomBytes } from 'node:crypto';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', onnotice: () => {} });

// Run each DDL statement individually so a pre-existing table/column
// never silently aborts the rest of the migration.
async function ddl(query) {
	await sql.unsafe(query);
}
async function addCol(table, col, def) {
	await sql.unsafe(
		`DO $$ BEGIN ALTER TABLE ${table} ADD COLUMN ${col} ${def};
		 EXCEPTION WHEN duplicate_column THEN NULL; END $$`
	);
}

await ddl(`CREATE TABLE IF NOT EXISTS meta (
	key   TEXT PRIMARY KEY,
	value TEXT NOT NULL
)`);

await ddl(`CREATE TABLE IF NOT EXISTS projects (
	id              SERIAL PRIMARY KEY,
	name            TEXT NOT NULL,
	note            TEXT NOT NULL DEFAULT '',
	status          TEXT NOT NULL DEFAULT 'active',
	color           TEXT NOT NULL DEFAULT '#6ea8fe',
	created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	last_touched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`);

await ddl(`CREATE TABLE IF NOT EXISTS tasks (
	id          SERIAL PRIMARY KEY,
	project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	title       TEXT NOT NULL,
	done        BOOLEAN NOT NULL DEFAULT FALSE,
	starred     BOOLEAN NOT NULL DEFAULT FALSE,
	position    INTEGER NOT NULL DEFAULT 0,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	done_at     TIMESTAMPTZ
)`);

await ddl(`CREATE TABLE IF NOT EXISTS habits (
	id               SERIAL PRIMARY KEY,
	name             TEXT NOT NULL,
	recurrence       TEXT NOT NULL DEFAULT 'daily',
	recurrence_value INTEGER,
	created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`);

await ddl(`CREATE TABLE IF NOT EXISTS habit_logs (
	id         SERIAL PRIMARY KEY,
	habit_id   INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
	log_date   DATE NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE(habit_id, log_date)
)`);

await ddl(`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`);
await ddl(`CREATE INDEX IF NOT EXISTS idx_habit_logs ON habit_logs(habit_id, log_date DESC)`);

// Column migrations — each in its own call, idempotent
await addCol('projects', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');
await addCol('tasks', 'recurrence', 'TEXT');
await addCol('tasks', 'recurrence_days', 'INTEGER');
await addCol('tasks', 'next_due', 'DATE');

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
	const a = new Date((from instanceof Date ? from.toISOString().slice(0, 10) : String(from)) + 'T00:00:00');
	const b = new Date((to instanceof Date ? to.toISOString().slice(0, 10) : String(to)) + 'T00:00:00');
	return Math.round((b - a) / 86_400_000);
}

function recurrenceDays(recurrence, customDays) {
	if (recurrence === 'daily') return 1;
	if (recurrence === 'weekly') return 7;
	if (recurrence === 'monthly') return 30;
	return Math.max(1, customDays || 7);
}

function toDateStr(val) {
	if (!val) return null;
	if (val instanceof Date) return val.toISOString().slice(0, 10);
	return String(val).slice(0, 10);
}

function habitStats(habit, logs, today) {
	const logDates = new Set(logs.map((l) => toDateStr(l.log_date)));
	const doneToday = logDates.has(today);
	const lastDoneRaw = logs[0]?.log_date ?? null;
	const lastDone = toDateStr(lastDoneRaw);

	const refDate = lastDone ?? toDateStr(habit.created_at) ?? today;
	const daysSince = dateDiffDays(refDate, today);

	let missCount = 0;
	if (!doneToday) {
		if (habit.recurrence === 'daily') {
			missCount = Math.max(0, daysSince - 1);
		} else if (habit.recurrence === 'weekly') {
			missCount = Math.floor(daysSince / 7);
		} else {
			missCount = Math.floor(daysSince / 30);
		}
	}

	return { doneToday, missCount, lastDone };
}

// --- meta ------------------------------------------------------------------

export async function getSessionSecret() {
	const rows = await sql`SELECT value FROM meta WHERE key = 'session_secret'`;
	if (rows.length) return rows[0].value;
	const secret = randomBytes(32).toString('hex');
	await sql`INSERT INTO meta (key, value) VALUES ('session_secret', ${secret}) ON CONFLICT (key) DO NOTHING`;
	const [row] = await sql`SELECT value FROM meta WHERE key = 'session_secret'`;
	return row.value;
}

// --- projects --------------------------------------------------------------

export async function listProjects(status = 'active') {
	const projects = await sql`
		SELECT * FROM projects WHERE status = ${status}
		ORDER BY sort_order ASC, last_touched_at ASC`;

	return Promise.all(
		projects.map(async (p) => {
			const [{ n: total }]     = await sql`SELECT COUNT(*)::int n FROM tasks WHERE project_id = ${p.id} AND (recurrence IS NULL OR next_due IS NULL OR next_due <= CURRENT_DATE)`;
			const [{ n: done }]      = await sql`SELECT COUNT(*)::int n FROM tasks WHERE project_id = ${p.id} AND done = TRUE AND recurrence IS NULL`;
			const [{ n: doneToday }] = await sql`SELECT COUNT(*)::int n FROM tasks WHERE project_id = ${p.id} AND done = TRUE AND recurrence IS NULL AND done_at::date = CURRENT_DATE`;
			const [{ n: hot }]       = await sql`SELECT COUNT(*)::int n FROM tasks WHERE project_id = ${p.id} AND done = FALSE AND starred = TRUE AND (next_due IS NULL OR next_due <= CURRENT_DATE)`;
			const next               = await sql`SELECT title FROM tasks WHERE project_id = ${p.id} AND done = FALSE AND (next_due IS NULL OR next_due <= CURRENT_DATE) ORDER BY starred DESC, position ASC, created_at ASC LIMIT 3`;

			return { ...p, total, done, doneToday, hot, next: next.map((t) => t.title) };
		})
	);
}

export async function statusCounts() {
	const rows = await sql`SELECT status, COUNT(*)::int n FROM projects GROUP BY status`;
	const out = { active: 0, backlog: 0, done: 0, dropped: 0 };
	for (const r of rows) out[r.status] = r.n;
	return out;
}

export async function createProject(name, note = '', color = '#6ea8fe') {
	const [{ m }] = await sql`SELECT COALESCE(MAX(sort_order), -1)::int m FROM projects WHERE status = 'active'`;
	const [{ id }] = await sql`
		INSERT INTO projects (name, note, color, sort_order)
		VALUES (${name}, ${note}, ${color}, ${m + 1}) RETURNING id`;
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

export async function reorderProjects(ids) {
	await Promise.all(ids.map((id, i) => sql`UPDATE projects SET sort_order = ${i} WHERE id = ${id}`));
}

// --- tasks -----------------------------------------------------------------

export async function listTasks(projectId) {
	return sql`
		SELECT * FROM tasks WHERE project_id = ${projectId}
		ORDER BY
			CASE
				WHEN done = TRUE AND recurrence IS NULL THEN 3
				WHEN recurrence IS NOT NULL AND next_due IS NOT NULL AND next_due > CURRENT_DATE THEN 2
				ELSE 1
			END ASC,
			starred DESC, position ASC, created_at ASC`;
}

export async function createTask(projectId, title, recurrence = null, recurrenceDaysParam = null) {
	const [{ m }] = await sql`SELECT COALESCE(MAX(position), 0)::int m FROM tasks WHERE project_id = ${projectId}`;
	const [{ id }] = await sql`
		INSERT INTO tasks (project_id, title, position, recurrence, recurrence_days)
		VALUES (${projectId}, ${title}, ${m + 1}, ${recurrence || null}, ${recurrenceDaysParam || null})
		RETURNING id`;
	await touchProject(projectId);
	return id;
}

export async function toggleTask(id) {
	const [t] = await sql`SELECT * FROM tasks WHERE id = ${id}`;
	if (!t) return;

	if (t.recurrence) {
		const today = localDateStr();
		const nextDueStr = toDateStr(t.next_due);
		if (nextDueStr && nextDueStr > today) {
			// Snoozed → un-snooze
			await sql`UPDATE tasks SET next_due = NULL WHERE id = ${id}`;
		} else {
			// Due → snooze
			const days = recurrenceDays(t.recurrence, t.recurrence_days);
			const nextDue = addDays(today, days);
			await sql`UPDATE tasks SET next_due = ${nextDue}, done_at = NOW() WHERE id = ${id}`;
		}
		await touchProject(t.project_id);
		return;
	}

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

// --- habits ----------------------------------------------------------------

export async function listHabits() {
	const habits = await sql`SELECT * FROM habits ORDER BY id ASC`;
	const today = localDateStr();

	return Promise.all(
		habits.map(async (h) => {
			const logs = await sql`
				SELECT log_date FROM habit_logs
				WHERE habit_id = ${h.id}
				ORDER BY log_date DESC LIMIT 365`;
			return { ...h, ...habitStats(h, logs, today) };
		})
	);
}

export async function createHabit(name, recurrence, recurrenceValue = null) {
	const [{ id }] = await sql`
		INSERT INTO habits (name, recurrence, recurrence_value)
		VALUES (${name}, ${recurrence}, ${recurrenceValue ?? null}) RETURNING id`;
	return id;
}

export async function deleteHabit(id) {
	await sql`DELETE FROM habits WHERE id = ${id}`;
}

export async function toggleHabitLog(habitId, date) {
	const [existing] = await sql`
		SELECT id FROM habit_logs WHERE habit_id = ${habitId} AND log_date = ${date}`;
	if (existing) {
		await sql`DELETE FROM habit_logs WHERE habit_id = ${habitId} AND log_date = ${date}`;
		return false;
	} else {
		await sql`INSERT INTO habit_logs (habit_id, log_date) VALUES (${habitId}, ${date})`;
		return true;
	}
}

export async function getHabitHistory(habitId, days = 60) {
	const today = localDateStr();
	const from = addDays(today, -days);
	const rows = await sql`
		SELECT log_date FROM habit_logs
		WHERE habit_id = ${habitId} AND log_date >= ${from}
		ORDER BY log_date DESC`;
	return rows.map((r) => toDateStr(r.log_date));
}

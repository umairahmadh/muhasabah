# CLAUDE.md — muhasabah

Working notes for future Claude sessions on this repo. Read before changing anything.

## What this is

A single-user personal project tracker. The product thesis: **out of sight = out of
mind**, so the home page ("the Wall") must show *every* active project's pulse at a
glance, and stale projects must surface themselves. We are NOT building Trello/Jira —
no teams, no boards, no drag-drop columns. Keep it light.

A project = `{ name, color, note, status, sort_order, tasks[] }`. Status ∈
`active | backlog | done | dropped`. Only `active` shows on the Wall, ordered by `sort_order` (drag-to-reorder).

## Stack (decided, don't relitigate)

- **SvelteKit** (Svelte 5 runes) + `@sveltejs/adapter-node` → builds to a plain Node
  server. No Docker (user rejected it — RAM). Run = `node build`.
- **SQLite** via `better-sqlite3`, one file (`muhasabah.db`).
- **Single-password auth**, HMAC session cookie. No users table.

## The DB adapter rule

`src/lib/server/db.js` is a **thin router** — it detects `DATABASE_URL` and
re-exports from the right adapter. **Never import a DB driver directly in routes.**

| File | What |
|---|---|
| `db.js` | Router: re-exports from sqlite or postgres adapter based on `DATABASE_URL` |
| `db-sqlite.js` | `better-sqlite3` adapter (default, no env needed) |
| `db-postgres.js` | `postgres` npm package adapter (Neon or any Postgres) |

Both adapters export the **exact same async API**. Adding a new DB operation means
adding it to both files with the same signature. Keep SQL compatible with both
dialects where possible (mostly straightforward — main differences: `SERIAL` vs
`INTEGER PRIMARY KEY`, `NOW()` vs `datetime('now')`, `BOOLEAN` vs `INTEGER 0/1`).

## Layout

| Path | Role |
|---|---|
| `src/lib/server/db.js` | Schema + every query. The only driver touch-point. |
| `src/lib/server/auth.js` | Password check + session token. |
| `src/hooks.server.js` | Auth guard: redirect to `/login` unless authed. |
| `src/routes/+page.*` | The Wall (home): projects grid, habits strip, drag reorder. |
| `src/routes/login/` | Login form + action. |
| `src/routes/habits/` | Habit manager: add/delete habits, 8-week grid, toggle today. |
| `src/routes/projects/[id]/` | Project detail: tasks (including recurring), star, status, delete. |

## Conventions

- Mutations are **SvelteKit form actions** with `use:enhance` (progressive, no client
  fetch glue). Keep it that way.
- Any task change calls `touchProject()` so the Wall's staleness/heartbeat stays true.
- Dark theme via CSS vars in `src/app.css`; per-project accent color is `--accent`.

## Run / verify

```bash
npm run dev          # http://localhost:5173
npm run build        # must pass before committing
```

## Workflow rules (from the user — follow every time)

- **Commit every change**, scoped per logical unit. Message format: `[scope] description`
  (e.g. `[db] add staleness query`, `[wall] show next tasks on card`).
- **Update this file + README** when behavior or architecture changes.
- **Persist decisions to memory** at
  `/Users/umairahmadh/.claude/projects/-Volumes-umair-PRJ-muhasabah/memory/` so nothing
  is forgotten between sessions.

## Habits system

- `habits` table: `id, name, recurrence (daily|weekly|monthly), recurrence_value, created_at`
- `habit_logs` table: `id, habit_id, log_date (YYYY-MM-DD), created_at` — one row per completion
- Miss count algorithm: for daily = `max(0, daysSinceLastDone - 1)`; weekly = `floor(days/7)`; monthly = `floor(days/30)`
- Wall shows a compact strip with today's checkboxes + miss labels; `/habits` shows full management + 8-week grid

## Recurring tasks

Tasks have optional `recurrence (daily|weekly|monthly|custom)`, `recurrence_days`, `next_due (date)`.
- When a recurring task is toggled done → it's **snoozed** (next_due set to future); never permanently done
- When snoozed task is toggled → **un-snoozed** (next_due cleared, comes back now)
- Project page splits tasks into: **recurring due** → **open** → **snoozed recurring** → **done**
- Snoozed tasks don't count in the done/total progress ratio

## Project reordering

`projects.sort_order INTEGER` — Wall orders by `sort_order ASC`. Drag a card to reorder; drop fires `?/reorder` action with comma-separated IDs.

## Product backlog (not yet built)

- A **Day / reckoning** view: tonight's tick-off + tomorrow's intentions, a scrollable
  diary of days.
- Backlog projects that "knock" after long silence instead of nagging daily.
- Weekly/monthly zoom-out: what moved, what went cold, what you dropped.

## Branches

- `main` — the published OSS app: **single-user**, one password. This is the product.
- `saas-experiment` — PARKED WIP: multi-tenant (users table, `user_id` scoping,
  signup/login). Not merged. Revisit only if we deliberately choose to go hosted.

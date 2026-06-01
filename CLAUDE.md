# CLAUDE.md — muhasabah

Working notes for future Claude sessions on this repo. Read before changing anything.

## What this is

A single-user personal project tracker. The product thesis: **out of sight = out of
mind**, so the home page ("the Wall") must show *every* active project's pulse at a
glance, and stale projects must surface themselves. We are NOT building Trello/Jira —
no teams, no boards, no drag-drop columns. Keep it light.

A project = `{ name, color, note, status, tasks[] }`. Status ∈
`active | backlog | done | dropped`. Only `active` shows on the Wall.

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
| `src/routes/+page.*` | The Wall (home): list/add projects, logout. |
| `src/routes/login/` | Login form + action. |
| `src/routes/projects/[id]/` | Project detail: tasks, star, status, delete. |

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

## Product backlog (not yet built)

The daily ritual is the soul of the app and is **not implemented yet**:
- A **Day / reckoning** view: tonight's tick-off + tomorrow's intentions, a scrollable
  diary of days.
- Backlog projects that "knock" after long silence instead of nagging daily.
- Weekly/monthly zoom-out: what moved, what went cold, what you dropped.

## Branches

- `main` — the published OSS app: **single-user**, one password. This is the product.
- `saas-experiment` — PARKED WIP: multi-tenant (users table, `user_id` scoping,
  signup/login). Not merged. Revisit only if we deliberately choose to go hosted.

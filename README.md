# muhasabah ✓

> *muhasabah* (محاسبة) — self-reckoning. At the end of the day you tick off what you did, and set what's next.

A dead-simple personal project OS for brains that forget what isn't on screen.
Not Trello. Not Jira. No teams, no boards, no ceremony. One screen — **the Wall** —
shows every project's pulse at a glance, so the thing you started three weeks ago
doesn't quietly die because you forgot it exists.

## Why

I start 100s of projects. I stay on a few, drop a few, backlog a few. The ones that
die don't die on purpose — they get buried. Every other tool makes you go *into* a
project to remember it. muhasabah brings every project *to you*, every day.

- **The Wall (home):** one glance, every active project — progress bar, the next
  1–3 tasks, today's tick count, and a *staleness* dot (fresh = green, going cold =
  faded). Projects you haven't touched drift up. Information, not punishment.
- **Tick to water it:** completing a task updates the project's heartbeat. The card
  glows. That's the dopamine receipt.
- **Light by design:** a project is just `{ name, color, tasks, status }`. Status is
  `active · backlog · done · dropped` — so parking something is a decision, not a leak.

## Run it

You need [Node](https://nodejs.org) 20+. No Docker, no database server required.

```bash
git clone <this repo>
cd muhasabah
npm install
cp .env.example .env      # edit MUHASABAH_PASSWORD at minimum
npm run dev               # http://localhost:5173
```

Production:

```bash
npm run build
MUHASABAH_PASSWORD=your-secret node build   # serves on PORT (default 3000)
```

## Database

muhasabah supports two backends, switched by environment variable:

### Option 1 — SQLite (default, self-host)

No extra config. A single `muhasabah.db` file sits next to the app.

```bash
cp muhasabah.db ~/backups/muhasabah-$(date +%F).db   # full backup
```

Run on any $4 VPS, Fly.io, Railway, or Render (needs a **persistent disk**).
Point [Litestream](https://litestream.io) at the file for continuous off-site backup.

### Option 2 — Postgres / Neon (free serverless deploy)

Set `DATABASE_URL` to a Postgres connection string and SQLite is never touched.
[Neon](https://neon.tech) has a generous free tier and works with Vercel/Koyeb/Render.

```bash
# .env
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
```

Tables are created automatically on first start. No migrations to run.

Deploy to [Vercel](https://vercel.com) (free): import repo → set `DATABASE_URL` +
`MUHASABAH_PASSWORD` env vars → deploy. Done.

## Config

| Env var | Default | What |
|---|---|---|
| `MUHASABAH_PASSWORD` | `muhasabah` | The single login password. **Change it.** |
| `DATABASE_URL` | *(unset)* | Postgres connection string. Omit to use SQLite. |
| `MUHASABAH_DB` | `./muhasabah.db` | SQLite file path (ignored when `DATABASE_URL` is set). |
| `PORT` | `3000` | Port for `node build`. |

## Auth

Single user. One password → signed session cookie. No accounts, no signup.

## License

MIT. Fork it, deploy it, make it yours.

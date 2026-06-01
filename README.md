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

---

## Run locally

You need [Node](https://nodejs.org) 20+. No Docker, no database server required.

```bash
git clone https://github.com/umairahmadh/muhasabah
cd muhasabah
npm install
cp .env.example .env      # set MUHASABAH_PASSWORD at minimum
npm run dev               # → http://localhost:5173
```

Data lives in `muhasabah.db` (SQLite) next to the app. Backup = `cp muhasabah.db ~/backup.db`.

---

## Deploy free: Vercel + Neon (recommended)

The simplest zero-cost personal deployment. No server to babysit, no disk to manage.

### 1. Create a Neon database (free)

1. Sign up at **[neon.tech](https://neon.tech)** — free tier is plenty for a personal app.
2. Create a project → copy the **Connection string** from the dashboard.
   It looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```
   Keep this — you'll need it in the next step.

### 2. Deploy to Vercel (free)

1. Push this repo to your GitHub (if not already).
2. Go to **[vercel.com](https://vercel.com)** → **Add New Project** → import your repo.
3. In **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | your Neon connection string |
   | `MUHASABAH_PASSWORD` | a strong password of your choice |
4. Click **Deploy**.

Tables are created automatically on first boot. No migrations, no CLI commands.

Your app is live at `https://your-project.vercel.app`. Done.

### Re-deploys

Push a commit to `main` → Vercel auto-deploys. Your data stays in Neon untouched.

---

## Self-host on a VPS (SQLite, full file ownership)

If you prefer owning the file and running it on your own box:

```bash
git clone https://github.com/umairahmadh/muhasabah
cd muhasabah
npm install
npm run build
MUHASABAH_PASSWORD=your-secret node build   # runs on PORT (default 3000)
```

Keep it alive with `pm2`:
```bash
npm install -g pm2
pm2 start "node build" --name muhasabah
pm2 save
```

Works on any $4/mo VPS (Hetzner, DigitalOcean, etc.), Fly.io (needs a persistent volume),
or Railway. The SQLite file needs a **persistent disk** — don't use plain Vercel/Netlify
without `DATABASE_URL` set.

---

## Config

| Env var | Default | What |
|---|---|---|
| `MUHASABAH_PASSWORD` | `muhasabah` | Single login password. **Change this.** |
| `DATABASE_URL` | *(unset)* | Postgres/Neon connection string. Omit to use SQLite. |
| `MUHASABAH_DB` | `./muhasabah.db` | SQLite file path (ignored when `DATABASE_URL` is set). |
| `PORT` | `3000` | Port for `node build`. |

## Auth

Single user. One password → signed session cookie. No accounts, no signup.

## License

MIT. Fork it, deploy it, make it yours.

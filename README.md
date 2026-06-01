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

You need [Node](https://nodejs.org) 20+. That's the only dependency. No Docker, no
database server, no cloud account.

```bash
git clone <this repo>
cd muhasabah
npm install
cp .env.example .env      # then edit MUHASABAH_PASSWORD
npm run dev               # http://localhost:5173
```

For a real (production) run:

```bash
npm run build
MUHASABAH_PASSWORD=your-secret node build   # serves on PORT (default 3000)
```

Keep it alive on a server with `pm2 start "node build" --name muhasabah` or a systemd
unit. Any $4 VPS, Fly.io, Railway, or Render works — it's just a Node process.

## Data & backup

Everything lives in **one SQLite file**, `muhasabah.db`, next to the app.

```bash
cp muhasabah.db ~/backups/muhasabah-$(date +%F).db   # that's the whole backup story
```

Move it, copy it, scp it, it's yours. (Want continuous off-site backup later? Point
[Litestream](https://litestream.io) at the file — zero app changes.)

## Config

| Env var | Default | What |
|---|---|---|
| `MUHASABAH_PASSWORD` | `muhasabah` | The single login password. **Change it.** |
| `MUHASABAH_DB` | `./muhasabah.db` | Path to the SQLite file. |
| `PORT` | `3000` | Port for `node build`. |

## Auth

Single user. No accounts, no signup. One password → a signed session cookie. The
whole auth system is [src/lib/server/auth.js](src/lib/server/auth.js), ~30 lines.

## License

MIT. Fork it, deploy it, make it yours.

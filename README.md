# G168 SPORT

A fully automated Telegram bot for football fixtures, data-based leans, and a
predict-and-score game. No admin needed once it's running.

> **Honesty note:** `/tips` shows a statistical lean with a confidence
> percentage (e.g. "Home win, ~58% confidence"), calculated from current
> league standings. This is an estimate, not a guarantee — no bot can know a
> result in advance. Keep the wording as-is; don't let it drift toward
> claiming certainty.

## Commands

- `/start` — welcome message
- `/tips` — today's data-based leans (auto-generated, no admin input)
- `/predict` — pick an upcoming match, then tap Home / Draw / Away
- `/leaderboard` — top predictors by points
- `/mystats` — your win rate, streak, points

## How scoring works

- A background job checks every 30 minutes for matches that kicked off more
  than 2 hours ago.
- If football-data.org reports the match as `FINISHED`, the bot records the
  result and awards +3 points to every user whose prediction matched.
- Nothing needs to be done manually — it's fully automatic.

## How the lean/confidence % is calculated

For each fixture, the bot pulls both teams' points-per-game from the current
league table, adds a fixed home-advantage bonus, and converts the gap into a
probability split across Home / Draw / Away (see `src/tips.js`). The highest
of the three becomes the lean, and its percentage is shown as the
"confidence." It's a simple, transparent heuristic — not betting advice.

## Setup

### 1. Get a Telegram bot token

- Message [@BotFather](https://t.me/BotFather) on Telegram
- Send `/newbot`, follow the prompts, name it "G168 SPORT" (or whatever you like)
- Copy the token it gives you

### 2. Get a free football-data.org API key

- Register at https://www.football-data.org/client/register
- Free tier: 10 requests/minute, covers Premier League, Champions League,
  La Liga, Bundesliga, Serie A, Ligue 1, and a few others

### 3. Configure

```bash
cp .env.example .env
```

Fill in `TELEGRAM_BOT_TOKEN` and `FOOTBALL_DATA_API_KEY` in `.env`.
Optionally edit `COMPETITIONS` to choose which leagues to track.

### 4. Install & run

```bash
npm install
npm start
```

The bot fetches fixtures on startup, then refreshes every 3 hours and checks
for finished matches every 30 minutes.

## Hosting

Runs fine on any small host that supports a long-running Node process —
Railway, Render, or a basic VPS all work. It uses a local SQLite file
(`g168.db`) for storage, so no external database is required.

**Note on Railway/Render:** make sure the storage volume/filesystem persists
between deploys, or `g168.db` (and everyone's points/predictions) will reset
each time you redeploy. On Railway, attach a persistent volume mounted at the
project root if you want scores to survive redeploys.

## Project structure

```
src/
  index.js        entry point — starts the bot + schedulers
  bot.js           Telegraf command & button handlers
  db.js            SQLite schema + queries (better-sqlite3)
  footballApi.js   football-data.org API client
  tips.js          lean/confidence heuristic
  scheduler.js     3-hourly fixture refresh + 30-min result check
```

## Notes on scope

- Free-tier football-data.org access is limited to a handful of top leagues
  — check their docs for the current list if you want to add competitions.
- The confidence % in `/tips` is a simple heuristic (league position +
  points per game + a home-advantage bonus). It's meant to be a fun,
  transparent lean — not betting advice, and it shouldn't be marketed as one.

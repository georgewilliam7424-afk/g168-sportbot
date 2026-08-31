import Database from 'better-sqlite3';

const db = new Database('g168.db');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS fixtures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_id INTEGER UNIQUE NOT NULL,
  competition TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_team_id INTEGER,
  away_team_id INTEGER,
  utc_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  home_score INTEGER,
  away_score INTEGER,
  lean TEXT,
  confidence REAL,
  scored INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  username TEXT,
  fixture_id INTEGER NOT NULL,
  choice TEXT NOT NULL, -- HOME | DRAW | AWAY
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, fixture_id)
);

CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY,
  username TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0
);
`);

export function upsertFixture(f) {
  const stmt = db.prepare(`
    INSERT INTO fixtures (api_id, competition, home_team, away_team, home_team_id, away_team_id, utc_date, status, lean, confidence)
    VALUES (@api_id, @competition, @home_team, @away_team, @home_team_id, @away_team_id, @utc_date, @status, @lean, @confidence)
    ON CONFLICT(api_id) DO UPDATE SET
      status = excluded.status,
      utc_date = excluded.utc_date,
      lean = excluded.lean,
      confidence = excluded.confidence
  `);
  stmt.run(f);
}

export function getUpcomingFixtures(limit = 15) {
  return db.prepare(`
    SELECT * FROM fixtures
    WHERE status = 'SCHEDULED'
    ORDER BY utc_date ASC
    LIMIT ?
  `).all(limit);
}

export function getTodaysTips(limit = 10) {
  return db.prepare(`
    SELECT * FROM fixtures
    WHERE status = 'SCHEDULED'
      AND date(utc_date) = date('now')
    ORDER BY utc_date ASC
    LIMIT ?
  `).all(limit);
}

export function getFixtureById(id) {
  return db.prepare(`SELECT * FROM fixtures WHERE id = ?`).get(id);
}

export function getFixturesToCheck() {
  // Kicked off more than 2 hours ago, not yet scored, still marked scheduled/in-play
  return db.prepare(`
    SELECT * FROM fixtures
    WHERE scored = 0
      AND status != 'FINISHED'
      AND datetime(utc_date) <= datetime('now', '-2 hours')
  `).all();
}

export function markFixtureFinished(apiId, homeScore, awayScore) {
  db.prepare(`
    UPDATE fixtures SET status = 'FINISHED', home_score = ?, away_score = ?
    WHERE api_id = ?
  `).run(homeScore, awayScore, apiId);
}

export function markFixtureScored(apiId) {
  db.prepare(`UPDATE fixtures SET scored = 1 WHERE api_id = ?`).run(apiId);
}

export function savePrediction(userId, username, fixtureId, choice) {
  const stmt = db.prepare(`
    INSERT INTO predictions (user_id, username, fixture_id, choice)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, fixture_id) DO UPDATE SET choice = excluded.choice, username = excluded.username
  `);
  stmt.run(userId, username, fixtureId, choice);

  db.prepare(`
    INSERT INTO users (user_id, username) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET username = excluded.username
  `).run(userId, username);
}

export function getPredictionsForFixture(fixtureApiId) {
  return db.prepare(`
    SELECT p.* FROM predictions p
    JOIN fixtures f ON f.id = p.fixture_id
    WHERE f.api_id = ?
  `).all(fixtureApiId);
}

export function awardPoints(userId, correct) {
  db.prepare(`
    UPDATE users SET
      total = total + 1,
      correct = correct + CASE WHEN ? THEN 1 ELSE 0 END,
      points = points + CASE WHEN ? THEN 3 ELSE 0 END,
      current_streak = CASE WHEN ? THEN current_streak + 1 ELSE 0 END,
      best_streak = CASE WHEN ? AND current_streak + 1 > best_streak THEN current_streak + 1 ELSE best_streak END
    WHERE user_id = ?
  `).run(correct ? 1 : 0, correct ? 1 : 0, correct ? 1 : 0, correct ? 1 : 0, userId);
}

export function getLeaderboard(limit = 10) {
  return db.prepare(`
    SELECT * FROM users
    WHERE total > 0
    ORDER BY points DESC, correct DESC
    LIMIT ?
  `).all(limit);
}

export function getUserStats(userId) {
  return db.prepare(`SELECT * FROM users WHERE user_id = ?`).get(userId);
}

export default db;

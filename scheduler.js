import cron from 'node-cron';
import { getStandings, getUpcomingMatches, getMatch } from './footballApi.js';
import { computeLean } from './tips.js';
import {
  upsertFixture,
  getFixturesToCheck,
  markFixtureFinished,
  markFixtureScored,
  getPredictionsForFixture,
  awardPoints
} from './db.js';

const COMPETITIONS = (process.env.COMPETITIONS || 'PL,PD,BL1,SA,FL1')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

const FIXTURE_WINDOW_DAYS = parseInt(process.env.FIXTURE_WINDOW_DAYS || '7', 10);

/**
 * Pulls standings + upcoming fixtures for each tracked competition,
 * computes a lean for each match, and stores/updates it locally.
 */
export async function refreshFixtures() {
  console.log('[refreshFixtures] starting...');
  for (const code of COMPETITIONS) {
    try {
      const standings = await getStandings(code);
      if (!standings) {
        console.warn(`[refreshFixtures] no standings for ${code}, skipping its fixtures`);
        continue;
      }

      const matches = await getUpcomingMatches(code, FIXTURE_WINDOW_DAYS);
      for (const m of matches) {
        const home = standings[m.homeTeam.id] || { ppg: 1.2, position: null };
        const away = standings[m.awayTeam.id] || { ppg: 1.2, position: null };
        const { lean, confidence } = computeLean(home, away);

        upsertFixture({
          api_id: m.id,
          competition: code,
          home_team: m.homeTeam.shortName || m.homeTeam.name,
          away_team: m.awayTeam.shortName || m.awayTeam.name,
          home_team_id: m.homeTeam.id,
          away_team_id: m.awayTeam.id,
          utc_date: m.utcDate,
          status: 'SCHEDULED',
          lean,
          confidence
        });
      }
      console.log(`[refreshFixtures] ${code}: ${matches.length} fixtures updated`);
    } catch (err) {
      console.error(`[refreshFixtures] failed for ${code}:`, err.message);
    }
  }
  console.log('[refreshFixtures] done.');
}

/**
 * Every 30 minutes: for matches that kicked off 2+ hours ago and aren't
 * scored yet, check football-data.org for FINISHED status, then award
 * +3 points to every prediction that matched the actual result.
 */
export async function checkResults() {
  const pending = getFixturesToCheck();
  if (pending.length === 0) return;

  console.log(`[checkResults] checking ${pending.length} pending fixture(s)...`);
  for (const fixture of pending) {
    try {
      const data = await getMatch(fixture.api_id);
      if (!data) continue;

      if (data.status === 'FINISHED') {
        const homeScore = data.score.fullTime.home;
        const awayScore = data.score.fullTime.away;
        markFixtureFinished(fixture.api_id, homeScore, awayScore);

        let actual = 'DRAW';
        if (homeScore > awayScore) actual = 'HOME';
        else if (awayScore > homeScore) actual = 'AWAY';

        const predictions = getPredictionsForFixture(fixture.api_id);
        for (const p of predictions) {
          awardPoints(p.user_id, p.choice === actual);
        }
        markFixtureScored(fixture.api_id);
        console.log(`[checkResults] scored fixture ${fixture.api_id} (${fixture.home_team} ${homeScore}-${awayScore} ${fixture.away_team}), ${predictions.length} prediction(s) settled`);
      }
      // If not finished yet (postponed, still in play, etc.) we just leave it
      // and it'll be re-checked on the next 30-minute cycle.
    } catch (err) {
      console.error(`[checkResults] failed for fixture ${fixture.api_id}:`, err.message);
    }
  }
}

export function startScheduler() {
  // Refresh fixtures & leans every 3 hours
  cron.schedule('0 */3 * * *', refreshFixtures);
  // Check for finished matches every 30 minutes
  cron.schedule('*/30 * * * *', checkResults);
}

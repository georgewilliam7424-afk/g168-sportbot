import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.football-data.org/v4',
  headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Free tier is 10 req/min, so we space out calls to be safe.
const REQUEST_GAP_MS = 6500;

async function get(path, params) {
  try {
    const res = await client.get(path, { params });
    return res.data;
  } catch (err) {
    if (err.response) {
      console.error(`football-data.org error ${err.response.status} on ${path}:`, err.response.data?.message || err.response.data);
    } else {
      console.error(`football-data.org request failed on ${path}:`, err.message);
    }
    return null;
  }
}

/**
 * Returns standings for a competition as a map of teamId -> {
 *   name, position, playedGames, points, ppg
 * }
 */
export async function getStandings(competitionCode) {
  const data = await get(`/competitions/${competitionCode}/standings`);
  await sleep(REQUEST_GAP_MS);
  if (!data) return null;

  const table = data.standings?.find((s) => s.type === 'TOTAL')?.table || [];
  const map = {};
  for (const row of table) {
    map[row.team.id] = {
      name: row.team.name,
      shortName: row.team.shortName || row.team.name,
      position: row.position,
      playedGames: row.playedGames,
      points: row.points,
      ppg: row.playedGames > 0 ? row.points / row.playedGames : 1.2 // neutral default for unplayed
    };
  }
  return map;
}

/**
 * Returns SCHEDULED matches for a competition within the next `days` days.
 */
export async function getUpcomingMatches(competitionCode, days = 7) {
  const dateFrom = new Date().toISOString().slice(0, 10);
  const dateTo = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const data = await get(`/competitions/${competitionCode}/matches`, {
    status: 'SCHEDULED',
    dateFrom,
    dateTo
  });
  await sleep(REQUEST_GAP_MS);
  if (!data) return [];
  return data.matches || [];
}

/**
 * Fetches a single match's current status/score by its football-data.org id.
 */
export async function getMatch(matchId) {
  const data = await get(`/matches/${matchId}`);
  await sleep(REQUEST_GAP_MS);
  return data;
}

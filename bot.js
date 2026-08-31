import { Telegraf, Markup } from 'telegraf';
import {
  getTodaysTips,
  getUpcomingFixtures,
  getFixtureById,
  savePrediction,
  getLeaderboard,
  getUserStats
} from './db.js';

const LEAN_LABEL = { HOME: 'Home win', DRAW: 'Draw', AWAY: 'Away win' };

function fmtKickoff(utcDate) {
  const d = new Date(utcDate);
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  }) + ' UTC';
}

export function createBot(token) {
  const bot = new Telegraf(token);

  bot.start((ctx) => {
    ctx.reply(
      `⚽ Welcome to G168 SPORT!\n\n` +
      `I'm a fully automated football companion bot. Here's what I can do:\n\n` +
      `/tips – today's data-based leans, calculated from current league standings\n` +
      `/predict – pick an upcoming match and call Home / Draw / Away\n` +
      `/leaderboard – top predictors by points\n` +
      `/mystats – your win rate, streak and points\n\n` +
      `Heads up: /tips gives a statistical lean with a confidence % — an estimate based on form, not a guarantee. No bot can know a result in advance!`
    );
  });

  bot.command('tips', (ctx) => {
    const tips = getTodaysTips(10);
    if (tips.length === 0) {
      return ctx.reply(
        `No fixtures found for today in the tracked leagues right now. Try /predict to see upcoming matches instead.`
      );
    }

    let msg = `📊 Today's data-based leans\n(estimates from current standings — not a guarantee)\n\n`;
    for (const f of tips) {
      msg += `${f.home_team} vs ${f.away_team}\n`;
      msg += `🕒 ${fmtKickoff(f.utc_date)} · ${f.competition}\n`;
      msg += `➡️ Lean: ${LEAN_LABEL[f.lean]} (~${Math.round(f.confidence)}% confidence)\n\n`;
    }
    ctx.reply(msg.trim());
  });

  bot.command('predict', (ctx) => {
    const fixtures = getUpcomingFixtures(8);
    if (fixtures.length === 0) {
      return ctx.reply(`No upcoming fixtures loaded yet — check back soon.`);
    }

    const buttons = fixtures.map((f) => [
      Markup.button.callback(
        `${f.home_team} vs ${f.away_team} — ${fmtKickoff(f.utc_date)}`,
        `pick_${f.id}`
      )
    ]);
    ctx.reply('Pick a match to predict:', Markup.inlineKeyboard(buttons));
  });

  bot.action(/^pick_(\d+)$/, async (ctx) => {
    const fixtureId = parseInt(ctx.match[1], 10);
    const fixture = getFixtureById(fixtureId);
    if (!fixture) return ctx.answerCbQuery('That match is no longer available.');

    await ctx.editMessageText(
      `${fixture.home_team} vs ${fixture.away_team}\n🕒 ${fmtKickoff(fixture.utc_date)}\n\nWho do you think wins?`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(fixture.home_team, `vote_${fixtureId}_HOME`),
          Markup.button.callback('Draw', `vote_${fixtureId}_DRAW`),
          Markup.button.callback(fixture.away_team, `vote_${fixtureId}_AWAY`)
        ]
      ])
    );
    ctx.answerCbQuery();
  });

  bot.action(/^vote_(\d+)_(HOME|DRAW|AWAY)$/, async (ctx) => {
    const fixtureId = parseInt(ctx.match[1], 10);
    const choice = ctx.match[2];
    const fixture = getFixtureById(fixtureId);
    if (!fixture) return ctx.answerCbQuery('That match is no longer available.');

    if (fixture.status !== 'SCHEDULED') {
      ctx.answerCbQuery('Predictions are closed for this match.');
      return;
    }

    const user = ctx.from;
    savePrediction(user.id, user.username || user.first_name, fixtureId, choice);

    const choiceLabel = choice === 'HOME' ? fixture.home_team : choice === 'AWAY' ? fixture.away_team : 'Draw';
    await ctx.editMessageText(
      `✅ Prediction saved: ${choiceLabel}\n${fixture.home_team} vs ${fixture.away_team}\n🕒 ${fmtKickoff(fixture.utc_date)}\n\nYou'll be auto-scored (+3 points) once the match finishes. Use /predict to pick another match.`
    );
    ctx.answerCbQuery('Saved!');
  });

  bot.command('leaderboard', (ctx) => {
    const top = getLeaderboard(10);
    if (top.length === 0) {
      return ctx.reply(`No predictions scored yet. Be the first — try /predict!`);
    }

    let msg = `🏆 Leaderboard\n\n`;
    top.forEach((u, i) => {
      const name = u.username || `Player ${u.user_id}`;
      const rate = u.total > 0 ? Math.round((u.correct / u.total) * 100) : 0;
      msg += `${i + 1}. ${name} — ${u.points} pts (${rate}% correct, ${u.total} predictions)\n`;
    });
    ctx.reply(msg.trim());
  });

  bot.command('mystats', (ctx) => {
    const stats = getUserStats(ctx.from.id);
    if (!stats || stats.total === 0) {
      return ctx.reply(`You haven't made any predictions yet. Try /predict to get started!`);
    }

    const rate = Math.round((stats.correct / stats.total) * 100);
    ctx.reply(
      `📈 Your stats\n\n` +
      `Points: ${stats.points}\n` +
      `Correct: ${stats.correct}/${stats.total} (${rate}%)\n` +
      `Current streak: ${stats.current_streak}\n` +
      `Best streak: ${stats.best_streak}`
    );
  });

  return bot;
}

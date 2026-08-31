import 'dotenv/config';
import { createBot } from './bot.js';
import { refreshFixtures, checkResults, startScheduler } from './scheduler.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN in .env');
  process.exit(1);
}
if (!FOOTBALL_DATA_API_KEY) {
  console.error('Missing FOOTBALL_DATA_API_KEY in .env');
  process.exit(1);
}

const bot = createBot(TELEGRAM_BOT_TOKEN);

async function main() {
  console.log('G168 SPORT starting up...');

  // Initial pull so /tips and /predict have data right away
  await refreshFixtures();
  await checkResults();

  startScheduler();

  await bot.launch();
  console.log('G168 SPORT is online.');
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

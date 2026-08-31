// Simple, transparent heuristic — NOT a prediction of certainty.
// Inputs: points-per-game for each side from current league standings,
// plus a fixed home-advantage bonus (roughly the historical PPG edge
// home teams carry across most leagues).
const HOME_ADVANTAGE_PPG = 0.35;

// Baseline probabilities before adjusting for form (typical top-league split).
const BASE_HOME = 45;
const BASE_DRAW = 27;
const BASE_AWAY = 28;

/**
 * @param {{ppg:number, position:number}} home
 * @param {{ppg:number, position:number}} away
 * @returns {{lean: 'HOME'|'DRAW'|'AWAY', confidence: number, homePct: number, drawPct: number, awayPct: number}}
 */
export function computeLean(home, away) {
  const diff = (home.ppg + HOME_ADVANTAGE_PPG) - away.ppg; // roughly -3.3 .. 3.3
  const shift = Math.max(-28, Math.min(28, diff * 14));

  let homePct = BASE_HOME + shift / 2;
  let awayPct = BASE_AWAY - shift / 2;
  let drawPct = 100 - homePct - awayPct;

  // Keep draw from collapsing to an unrealistic floor
  if (drawPct < 14) {
    const deficit = 14 - drawPct;
    drawPct = 14;
    if (homePct > awayPct) homePct -= deficit; else awayPct -= deficit;
  }

  // Normalize rounding drift
  const total = homePct + drawPct + awayPct;
  homePct = (homePct / total) * 100;
  drawPct = (drawPct / total) * 100;
  awayPct = (awayPct / total) * 100;

  let lean = 'DRAW';
  let confidence = drawPct;
  if (homePct >= drawPct && homePct >= awayPct) {
    lean = 'HOME';
    confidence = homePct;
  } else if (awayPct >= drawPct && awayPct >= homePct) {
    lean = 'AWAY';
    confidence = awayPct;
  }

  return {
    lean,
    confidence: Math.round(confidence),
    homePct: Math.round(homePct),
    drawPct: Math.round(drawPct),
    awayPct: Math.round(awayPct)
  };
}

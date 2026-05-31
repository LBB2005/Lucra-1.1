// Shared Markov regime types + stdout parser.
//
// The skill itself is a local Python program (uv) that cannot run on Vercel
// serverless. Two callers parse its stdout: the GET /api/markov route (local
// dev, shells out directly) and POST /api/markov/ingest (an external cron POSTs
// the captured stdout). Keeping the parser here avoids duplicating the regexes.

export interface MarkovData {
  ticker: string;
  years: number;
  fetchedAt: string;
  rows: number;
  dateRange: { start: string; end: string };
  transitionMatrix: {
    Bear: { Bear: number; Sideways: number; Bull: number };
    Sideways: { Bear: number; Sideways: number; Bull: number };
    Bull: { Bear: number; Sideways: number; Bull: number };
  };
  persistence: { Bear: number; Sideways: number; Bull: number };
  stationary: { Bear: number; Sideways: number; Bull: number };
  backtest: { sharpe: number; maxDrawdown: number; trades: number };
  hmm: { Bear: number; Sideways: number; Bull: number } | null;
  currentBias: "Bull" | "Sideways" | "Bear";
  allocationRec: { equityPct: number; label: string; rationale: string };
}

export function parseMarkovOutput(raw: string, ticker: string, years: number): MarkovData {
  // Date range + rows
  const rowsMatch = raw.match(/fetched (\d+) rows \| (\S+) -> (\S+)/);
  const rows = rowsMatch ? parseInt(rowsMatch[1]) : 0;
  const dateStart = rowsMatch ? rowsMatch[2] : "";
  const dateEnd = rowsMatch ? rowsMatch[3] : "";

  // Transition matrix — parse each row
  // e.g. "       Bear    86.23%    13.77%     0.00%"
  function parsePct(s: string): number {
    const m = s.match(/([\d.]+)%/);
    return m ? parseFloat(m[1]) : 0;
  }

  const bearRow = raw.match(/\s+Bear\s+([\d.]+%)\s+([\d.]+%)\s+([\d.]+%)/);
  const sidewaysRow = raw.match(/\s+Sideways\s+([\d.]+%)\s+([\d.]+%)\s+([\d.]+%)/);
  const bullRow = raw.match(/\s+Bull\s+([\d.]+%)\s+([\d.]+%)\s+([\d.]+%)/);

  const transitionMatrix = {
    Bear: {
      Bear: bearRow ? parsePct(bearRow[1]) : 0,
      Sideways: bearRow ? parsePct(bearRow[2]) : 0,
      Bull: bearRow ? parsePct(bearRow[3]) : 0,
    },
    Sideways: {
      Bear: sidewaysRow ? parsePct(sidewaysRow[1]) : 0,
      Sideways: sidewaysRow ? parsePct(sidewaysRow[2]) : 0,
      Bull: sidewaysRow ? parsePct(sidewaysRow[3]) : 0,
    },
    Bull: {
      Bear: bullRow ? parsePct(bullRow[1]) : 0,
      Sideways: bullRow ? parsePct(bullRow[2]) : 0,
      Bull: bullRow ? parsePct(bullRow[3]) : 0,
    },
  };

  const persistence = {
    Bear: transitionMatrix.Bear.Bear,
    Sideways: transitionMatrix.Sideways.Sideways,
    Bull: transitionMatrix.Bull.Bull,
  };

  // Stationary distribution
  const statBear = raw.match(/Bear:\s*([\d.]+)%/);
  const statSideways = raw.match(/Sideways:\s*([\d.]+)%/);
  const statBull = raw.match(/Bull:\s*([\d.]+)%/);

  const stationary = {
    Bear: statBear ? parseFloat(statBear[1]) : 0,
    Sideways: statSideways ? parseFloat(statSideways[1]) : 0,
    Bull: statBull ? parseFloat(statBull[1]) : 0,
  };

  // Walk-forward backtest
  const sharpeMatch = raw.match(/Sharpe \(annualised, walk-forward\):\s*([-\d.]+)/);
  const drawdownMatch = raw.match(/Max drawdown:\s*([-\d.]+)%/);
  const tradesMatch = raw.match(/Trades evaluated:\s*(\d+)/);

  const backtest = {
    sharpe: sharpeMatch ? parseFloat(sharpeMatch[1]) : 0,
    maxDrawdown: drawdownMatch ? parseFloat(drawdownMatch[1]) : 0,
    trades: tradesMatch ? parseInt(tradesMatch[1]) : 0,
  };

  // HMM mean daily returns
  // "Bear (lowest mean return)      state 2: -0.143% per day"
  // "Sideways                       state 0: +0.083% per day"
  // "Bull (highest mean return)     state 1: +0.086% per day"
  let hmm: MarkovData["hmm"] = null;
  const hmmSection = raw.includes("HMM regime mean daily returns");
  if (hmmSection) {
    const hmmBear = raw.match(/Bear.*state \d+:\s*([+-]?[\d.]+)% per day/);
    const hmmSideways = raw.match(/Sideways.*state \d+:\s*([+-]?[\d.]+)% per day/);
    const hmmBull = raw.match(/Bull.*state \d+:\s*([+-]?[\d.]+)% per day/);
    if (hmmBear && hmmSideways && hmmBull) {
      hmm = {
        Bear: parseFloat(hmmBear[1]),
        Sideways: parseFloat(hmmSideways[1]),
        Bull: parseFloat(hmmBull[1]),
      };
    }
  }

  // Derive current bias from stationary distribution
  const currentBias: MarkovData["currentBias"] =
    stationary.Bear > 30 ? "Bear" : stationary.Bull > 40 ? "Bull" : "Sideways";

  // Allocation recommendation
  // Bull bias → high equity, Bear → defensive, Sideways → balanced
  const equityPct =
    Math.round(stationary.Bull * 1.0 + stationary.Sideways * 0.65 + stationary.Bear * 0.3);
  const allocationRec = {
    equityPct,
    label:
      equityPct >= 70 ? "Fully Invested" : equityPct >= 50 ? "Balanced" : "Defensive",
    rationale: `Based on ${stationary.Bull.toFixed(0)}% long-run Bull / ${stationary.Sideways.toFixed(0)}% Sideways / ${stationary.Bear.toFixed(0)}% Bear regime mix. ${currentBias === "Bull" ? "Regime persistence favors staying long." : currentBias === "Bear" ? "Bear regime persists — reduce risk." : "Neutral regime — maintain balanced exposure."}`,
  };

  return {
    ticker,
    years,
    fetchedAt: new Date().toISOString(),
    rows,
    dateRange: { start: dateStart, end: dateEnd },
    transitionMatrix,
    persistence,
    stationary,
    backtest,
    hmm,
    currentBias,
    allocationRec,
  };
}

// If the script output drifts, every regex misses and we'd cache an all-zero
// matrix as if it were a real signal. This guard lets callers reject that so the
// client sees an error instead of fabricated data.
export function isMarkovDataValid(data: MarkovData): boolean {
  const statSum = data.stationary.Bear + data.stationary.Sideways + data.stationary.Bull;
  return data.rows > 0 && statSum >= 1;
}

/** Clamp a percentage into the legal 0–100 range. */
export const clampPct = (n: number): number =>
  Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;

/**
 * Rescale a Bear/Sideways/Bull regime triple so it always sums to 100%.
 *
 * The Python script's stationary distribution *should* already sum to 1, but
 * the stdout parser can latch onto the wrong line (e.g. a persistence-diagonal
 * value), and averaging several tickers compounds the drift. Normalizing at the
 * display boundary guarantees the UI never shows impossible probabilities
 * (a "88% Bull / 86% Bear" read, or a regime bar that disagrees with its label).
 */
export function normalizeRegime(
  bear: number,
  sideways: number,
  bull: number,
): { bear: number; sideways: number; bull: number } {
  const b = Math.max(0, bear || 0);
  const s = Math.max(0, sideways || 0);
  const u = Math.max(0, bull || 0);
  const total = b + s + u;
  if (total <= 0) return { bear: 0, sideways: 0, bull: 0 };
  return { bear: (b / total) * 100, sideways: (s / total) * 100, bull: (u / total) * 100 };
}

/** The dominant regime of a normalized triple — guarantees label matches the bar. */
export function dominantRegime(r: { bear: number; sideways: number; bull: number }): MarkovData["currentBias"] {
  if (r.bull >= r.bear && r.bull >= r.sideways) return "Bull";
  if (r.bear >= r.sideways) return "Bear";
  return "Sideways";
}

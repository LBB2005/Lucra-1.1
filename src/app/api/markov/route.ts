import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { db } from "@/lib/firebase-admin";
import os from "os";
import path from "path";

const execAsync = promisify(exec);

// Tickers are interpolated into a shell command, so they must be strictly validated
// to prevent command injection. Allow letters, digits, dot and hyphen only.
const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

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

// Cache is considered fresh for 20 hours — nightly cron refreshes it
const CACHE_TTL_MS = 20 * 60 * 60 * 1000;

function parseMarkovOutput(raw: string, ticker: string, years: number): MarkovData {
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
  const maxRegime = (["Bull", "Sideways", "Bear"] as const).reduce((a, b) =>
    stationary[a] >= stationary[b] ? a : b
  );
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

  void maxRegime; // used for currentBias derivation above

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

async function runMarkov(ticker: string, years: number): Promise<MarkovData> {
  const skillDir = process.env.MARKOV_SKILL_PATH
    ?? path.join(os.homedir(), ".claude/skills/markov-hedge-fund-method");
  const uvPath = process.env.UV_PATH
    ?? path.join(os.homedir(), ".local/bin/uv");

  if (!TICKER_RE.test(ticker)) {
    throw new Error(`Invalid ticker symbol: ${ticker}`);
  }
  const safeYears = Number.isFinite(years) && years > 0 && years <= 50 ? Math.floor(years) : 5;

  const { stdout } = await execAsync(
    `"${uvPath}" run python -m markov_hedge_fund_method.run --ticker ${ticker} --years ${safeYears}`,
    { cwd: skillDir, timeout: 120_000 }
  );

  const data = parseMarkovOutput(stdout, ticker, safeYears);
  // If the script output drifts, every regex misses and we'd cache an all-zero matrix
  // as a real signal. Reject that so the caller sees an error instead of fake data.
  const statSum = data.stationary.Bear + data.stationary.Sideways + data.stationary.Bull;
  if (data.rows === 0 || statSum < 1) {
    throw new Error(`Markov parse failed for ${ticker} — unexpected script output`);
  }
  return data;
}

// GET /api/markov?tickers=SPY,QQQ,DIA&years=5&force=1
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers") ?? "SPY,QQQ,DIA";
  const years = parseInt(searchParams.get("years") ?? "5");
  const force = searchParams.get("force") === "1";

  const tickers = tickersParam.split(",").map((t) => t.trim().toUpperCase());

  const results: Record<string, MarkovData> = {};
  const errors: Record<string, string> = {};

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        // Check cache first
        const cacheDocId = `${ticker}_${years}`;
        const cacheRef = db.collection("markovResults").doc(cacheDocId);
        if (!force) {
          const cached = await cacheRef.get();
          if (cached.exists) {
            const cacheData = cached.data()!;
            const createdAt = typeof cacheData.createdAt === "string"
              ? cacheData.createdAt
              : cacheData.createdAt?.toDate?.().toISOString() ?? "";
            const age = Date.now() - new Date(createdAt).getTime();
            if (age < CACHE_TTL_MS) {
              results[ticker] = JSON.parse(cacheData.result) as MarkovData;
              return;
            }
          }
        }

        // Run the Python script
        const data = await runMarkov(ticker, years);

        // Upsert into DB
        const now = new Date().toISOString();
        await cacheRef.set({ ticker, years, result: JSON.stringify(data), createdAt: now });

        results[ticker] = data;
      } catch (err) {
        errors[ticker] = err instanceof Error ? err.message : "Unknown error";
      }
    })
  );

  return NextResponse.json({ results, errors, generatedAt: new Date().toISOString() });
}

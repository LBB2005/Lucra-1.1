import type { CandleResponse } from "@/lib/finnhub";

// Alpaca market-data API is always served from data.alpaca.markets, regardless of
// whether trading uses the paper or live host. Keys are the same as the trading API.
const DATA_BASE = "https://data.alpaca.markets";
const KEY = process.env.ALPACA_API_KEY;
const SECRET = process.env.ALPACA_API_SECRET;
// Free Alpaca accounts only have access to the IEX feed; paid plans may set "sip".
const FEED = process.env.ALPACA_DATA_FEED ?? "iex";

const FETCH_TIMEOUT_MS = 10_000;

// Map a Finnhub-style resolution (1,5,15,30,60,D,W,M) to an Alpaca timeframe.
function resolutionToAlpaca(resolution: string): string {
  switch (resolution) {
    case "D": return "1Day";
    case "W": return "1Week";
    case "M": return "1Month";
    case "60": return "1Hour";
    default: {
      const n = parseInt(resolution, 10);
      return Number.isFinite(n) && n > 0 ? `${n}Min` : "1Day";
    }
  }
}

interface AlpacaBar {
  t: string; // RFC3339 timestamp
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export function hasAlpacaData(): boolean {
  return Boolean(KEY && SECRET);
}

// Fetch OHLCV bars from Alpaca and reshape into the Finnhub candle format so every
// caller (technical agent, risk agent, backtest) keeps working unchanged.
export async function getAlpacaBars(
  ticker: string,
  resolution: string,
  fromTs: number,
  toTs: number
): Promise<CandleResponse> {
  if (!KEY || !SECRET) {
    return { s: "no_data", c: [], o: [], h: [], l: [], v: [], t: [] };
  }

  const timeframe = resolutionToAlpaca(resolution);
  const start = new Date(fromTs * 1000).toISOString();
  const end = new Date(toTs * 1000).toISOString();

  const headers = {
    "APCA-API-KEY-ID": KEY,
    "APCA-API-SECRET-KEY": SECRET,
  };

  const bars: AlpacaBar[] = [];
  let pageToken: string | undefined;
  // Cap pages so a malformed next_page_token can never loop forever.
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      timeframe,
      start,
      end,
      limit: "10000",
      adjustment: "split",
      feed: FEED,
    });
    if (pageToken) params.set("page_token", pageToken);

    const res = await fetch(
      `${DATA_BASE}/v2/stocks/${encodeURIComponent(ticker)}/bars?${params}`,
      { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), next: { revalidate: 30 } }
    );
    if (!res.ok) throw new Error(`Alpaca bars ${res.status}: ${ticker}`);

    const data = (await res.json()) as { bars?: AlpacaBar[]; next_page_token?: string | null };
    if (Array.isArray(data.bars)) bars.push(...data.bars);

    if (!data.next_page_token) break;
    pageToken = data.next_page_token;
  }

  if (bars.length === 0) {
    return { s: "no_data", c: [], o: [], h: [], l: [], v: [], t: [] };
  }

  return {
    s: "ok",
    c: bars.map((b) => b.c),
    o: bars.map((b) => b.o),
    h: bars.map((b) => b.h),
    l: bars.map((b) => b.l),
    v: bars.map((b) => b.v),
    t: bars.map((b) => Math.floor(new Date(b.t).getTime() / 1000)),
  };
}

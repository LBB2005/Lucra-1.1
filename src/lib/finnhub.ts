const BASE = "https://finnhub.io/api/v1";
const KEY = process.env.FINNHUB_API_KEY;

async function fhFetch(path: string) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${path}${sep}token=${KEY}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`Finnhub ${res.status}: ${path}`);
  return res.json();
}

export interface TickerSnapshot {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
}

// Real-time quote for a single ticker
export async function getQuote(ticker: string): Promise<TickerSnapshot> {
  const d = await fhFetch(`/quote?symbol=${ticker}`);
  return {
    ticker,
    price: d.c ?? 0,
    change: d.d ?? 0,
    changePct: d.dp ?? 0,
    volume: 0,
    high: d.h ?? 0,
    low: d.l ?? 0,
    open: d.o ?? 0,
    prevClose: d.pc ?? 0,
  };
}

// Batch quotes for multiple tickers
export async function getSnapshots(tickers: string[]): Promise<TickerSnapshot[]> {
  if (!tickers.length) return [];
  const results = await Promise.allSettled(tickers.map(getQuote));
  return results
    .filter((r): r is PromiseFulfilledResult<TickerSnapshot> => r.status === "fulfilled")
    .map((r) => r.value);
}

// OHLCV candles for technical analysis
// resolution: 1, 5, 15, 30, 60, D, W, M
export async function getCandles(ticker: string, resolution: string, fromTs: number, toTs: number) {
  return fhFetch(`/stock/candle?symbol=${ticker}&resolution=${resolution}&from=${fromTs}&to=${toTs}`);
}

// Company news
export async function getCompanyNews(ticker: string, fromDate: string, toDate: string) {
  return fhFetch(`/company-news?symbol=${ticker}&from=${fromDate}&to=${toDate}`);
}

// General market news
export async function getMarketNews(category: "general" | "forex" | "crypto" | "merger" = "general") {
  return fhFetch(`/news?category=${category}`);
}

// Reported financials (annual/quarterly)
export async function getFinancialsReported(ticker: string, freq: "annual" | "quarterly" = "annual") {
  return fhFetch(`/stock/financials-reported?symbol=${ticker}&freq=${freq}`);
}

// Basic financials metrics (P/E, EV/EBITDA, margins, etc.)
export async function getBasicFinancials(ticker: string) {
  return fhFetch(`/stock/metric?symbol=${ticker}&metric=all`);
}

// Historical EPS surprises
export async function getEarnings(ticker: string) {
  return fhFetch(`/stock/earnings?symbol=${ticker}&limit=8`);
}

// Upcoming earnings calendar
export async function getEarningsCalendar(fromDate: string, toDate: string, ticker?: string) {
  const sym = ticker ? `&symbol=${ticker}` : "";
  return fhFetch(`/calendar/earnings?from=${fromDate}&to=${toDate}${sym}`);
}

// Insider transactions (Form 4)
export async function getInsiderTransactions(ticker: string) {
  return fhFetch(`/stock/insider-transactions?symbol=${ticker}`);
}

// Recommendation trends (analyst ratings)
export async function getRecommendationTrends(ticker: string) {
  return fhFetch(`/stock/recommendation?symbol=${ticker}`);
}

// Analyst price targets
export async function getPriceTarget(ticker: string) {
  return fhFetch(`/stock/price-target?symbol=${ticker}`);
}

// Company profile
export async function getCompanyProfile(ticker: string) {
  return fhFetch(`/stock/profile2?symbol=${ticker}`);
}

// Peers
export async function getPeers(ticker: string) {
  return fhFetch(`/stock/peers?symbol=${ticker}`);
}

// Major sector ETFs for macro context
export async function getMarketSnapshot(): Promise<TickerSnapshot[]> {
  const etfs = ["SPY", "QQQ", "IWM", "XLK", "XLF", "XLV", "XLE", "XLY", "XLI", "XLP"];
  return getSnapshots(etfs);
}

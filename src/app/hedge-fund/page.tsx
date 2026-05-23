"use client";
import { useState, useEffect } from "react";
import useSWR from "swr";

import type {
  HFTab, HFData, TickerMarkov, Regime,
  Strategy, Order, Fill, WatchItem,
} from "@/components/hedge-fund/types";
import { HFSubnav }     from "@/components/hedge-fund/HFSubnav";
import { HFOverview }   from "@/components/hedge-fund/HFOverview";
import { HFTrading }    from "@/components/hedge-fund/HFTrading";
import { HFStrategies } from "@/components/hedge-fund/HFStrategies";
import { HFBot }        from "@/components/hedge-fund/HFBot";
import type { MarkovData } from "@/app/api/markov/route";
import type { AlpacaAccount } from "@/app/api/alpaca/account/route";
import type { TickerSnapshot } from "@/lib/finnhub";

// ── API types ─────────────────────────────────────────────────────────────────

type MarkovResponse = {
  results: Record<string, MarkovData>;
  errors: Record<string, string>;
  generatedAt: string;
};

async function fetchMarkov(url: string): Promise<MarkovResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch Markov data");
  return res.json();
}

async function fetchAlpaca(url: string): Promise<AlpacaAccount> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Alpaca fetch failed");
  return res.json();
}

async function fetchStrategies(url: string): Promise<Strategy[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch strategies");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchOrders(url: string): Promise<Order[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchFills(url: string): Promise<Fill[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchQuotes(url: string): Promise<TickerSnapshot[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ── Ticker display names ──────────────────────────────────────────────────────

const TICKER_NAMES: Record<string, string> = {
  SPY:  "S&P 500 ETF",
  QQQ:  "Nasdaq 100 ETF",
  DIA:  "Dow Jones ETF",
  IWM:  "Russell 2000 ETF",
  NVDA: "NVIDIA",
  AAPL: "Apple",
  MSFT: "Microsoft",
  GOOGL:"Alphabet",
  META: "Meta Platforms",
  TSLA: "Tesla",
  AMZN: "Amazon",
  AMD:  "Advanced Micro Devices",
  SMCI: "Super Micro Computer",
  PLTR: "Palantir",
  COIN: "Coinbase",
  CRWD: "CrowdStrike",
  JPM:  "JPMorgan Chase",
  VIX:  "CBOE VIX",
};

const INDEX_TICKERS: Record<string, string> = {
  SPY: "S&P 500",
  QQQ: "Nasdaq 100",
  DIA: "Dow Jones",
};

// ── Markov helpers ────────────────────────────────────────────────────────────

function buildMarkovSection(
  apiData: MarkovResponse,
  tickerKeys: string[],
): HFData["markov"] {
  const tickers: TickerMarkov[] = tickerKeys
    .map((t) => {
      const d = apiData.results[t];
      if (!d) return null;
      return {
        ticker: t,
        label: INDEX_TICKERS[t] ?? t,
        bias: d.currentBias as Regime,
        rows: d.rows,
        dateRange: d.dateRange,
        stationary: d.stationary,
        persistence: d.persistence,
        transitionMatrix: d.transitionMatrix,
        hmm: d.hmm ?? { Bull: 0, Sideways: 0, Bear: 0 },
        backtest: d.backtest,
        allocationRec: d.allocationRec,
      } satisfies TickerMarkov;
    })
    .filter((t): t is TickerMarkov => t !== null);

  const avgBull   = tickers.reduce((s, t) => s + t.stationary.Bull,          0) / (tickers.length || 1);
  const avgBear   = tickers.reduce((s, t) => s + t.stationary.Bear,          0) / (tickers.length || 1);
  const avgSharpe = tickers.reduce((s, t) => s + t.backtest.sharpe,           0) / (tickers.length || 1);
  const equityPct = Math.round(tickers.reduce((s, t) => s + t.allocationRec.equityPct, 0) / (tickers.length || 1));

  const bias: Regime =
    avgBear > 28 ? "Bear" : avgBull > 42 ? "Bull" : "Sideways";

  return {
    generatedAt: apiData.generatedAt,
    composite: { bias, avgBull, avgBear, avgSharpe, equityPct },
    tickers,
  };
}

function markovSignal(ticker: string, markov: HFData["markov"]): Regime {
  return markov.tickers.find((t) => t.ticker === ticker)?.bias ?? markov.composite.bias;
}

// ── Bot mock (real data served by /api/bot when bot is running) ────────────────

const MOCK_BOT: HFData["bot"] = {
  status: "Stopped",
  uptime: "0h",
  strategiesActive: 0,
  cashAllocated: 0,
  cashFree: 0,
  todayTrades: 0,
  todayPnL: 0,
  schedule: "9:35 ET start · 15:55 ET flatten intraday",
  lastHeartbeat: "—",
  log: [],
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HedgeFundPage() {
  const [activeTab, setActiveTab] = useState<HFTab>("overview");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("tab") as HFTab | null;
    const valid: HFTab[] = ["overview", "strategies", "trading", "bot"];
    if (p && valid.includes(p)) setActiveTab(p);
  }, []);

  function handleTab(tab: HFTab) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }

  // Markov data
  const { data: markovApiData, error: markovError, isLoading: markovLoading } = useSWR<MarkovResponse>(
    "/api/markov?tickers=SPY,QQQ,DIA&years=5",
    fetchMarkov,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  // Alpaca account (buying power, day P&L)
  const { data: alpacaData } = useSWR<AlpacaAccount>(
    "/api/alpaca/account",
    fetchAlpaca,
    { refreshInterval: 30_000, revalidateOnFocus: true },
  );

  // Strategies from DB
  const { data: strategiesData } = useSWR<Strategy[]>(
    "/api/strategies",
    fetchStrategies,
    { revalidateOnFocus: false, dedupingInterval: 5_000 },
  );

  // Open orders from Alpaca (empty until trades are placed)
  const { data: ordersData } = useSWR<Order[]>(
    "/api/alpaca/orders",
    fetchOrders,
    { refreshInterval: 10_000, revalidateOnFocus: true },
  );

  // Today's fills from Alpaca
  const { data: fillsData } = useSWR<Fill[]>(
    "/api/alpaca/activities",
    fetchFills,
    { refreshInterval: 30_000, revalidateOnFocus: true },
  );

  const alpaca     = alpacaData?.live ? alpacaData : null;
  const strategies = strategiesData ?? [];

  // Build watchlist from active strategy tickers + Finnhub live quotes
  const activeTickers = [
    ...new Set(strategies.filter((s) => s.active).flatMap((s) => s.tickers)),
  ];

  const quotesKey = activeTickers.length > 0
    ? `/api/quotes?tickers=${activeTickers.join(",")}`
    : null;

  const { data: quotesData } = useSWR<TickerSnapshot[]>(
    quotesKey,
    fetchQuotes,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );

  // Assemble Markov section
  const markovSection = markovApiData
    ? buildMarkovSection(markovApiData, ["SPY", "QQQ", "DIA"])
    : {
        generatedAt: new Date().toISOString(),
        composite: { bias: "Sideways" as Regime, avgBull: 41.2, avgBear: 22.5, avgSharpe: 0.74, equityPct: 68 },
        tickers: [],
      };

  // Build watchlist from quotes
  const watchlist: WatchItem[] = (quotesData ?? []).map((q) => ({
    ticker:  q.ticker,
    name:    TICKER_NAMES[q.ticker] ?? q.ticker,
    px:      q.price,
    dayPct:  q.changePct,
    bid:     +(q.price * 0.9999).toFixed(2),
    ask:     +(q.price * 1.0001).toFixed(2),
    signal:  markovSignal(q.ticker, markovSection),
  }));

  const hfData: HFData = {
    markov: markovSection,
    trading: {
      buyingPower: alpaca?.buyingPower ?? 0,
      dayPnL:      alpaca?.dayPl      ?? 0,
      dayPnLPct:   alpaca?.dayPlPct   ?? 0,
      openOrders:  Array.isArray(ordersData) ? ordersData : [],
      fills:       Array.isArray(fillsData)  ? fillsData  : [],
      watchlist,
    },
    strategies,
    bot: MOCK_BOT,
  };

  return (
    <div className="hf-shell">
      <HFSubnav
        activeTab={activeTab}
        onTab={handleTab}
        bot={hfData.bot}
        nav={hfData.trading.buyingPower + hfData.bot.cashAllocated}
        dayPnL={hfData.trading.dayPnL}
        isLive={!!alpaca}
      />

      <div className="hf-body">
        {activeTab === "overview" && (
          <HFOverview data={hfData} onTab={handleTab} />
        )}
        {activeTab === "trading" && (
          <HFTrading trading={hfData.trading} />
        )}
        {activeTab === "strategies" && (
          <HFStrategies
            strategies={hfData.strategies}
            markov={hfData.markov}
            markovLoading={markovLoading}
            markovError={markovError ? (markovError as Error).message : null}
          />
        )}
        {activeTab === "bot" && (
          <HFBot bot={hfData.bot} strategies={hfData.strategies} />
        )}
      </div>
    </div>
  );
}

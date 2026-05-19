"use client";
import { useQuotes } from "./useQuotes";

export interface PulseItem {
  label: string;
  ticker: string;
  value: string;
  chg: number;
}

const PULSE_TICKERS = ["SPY", "QQQ", "DIA", "TLT", "GLD", "USO"];

const LABELS: Record<string, string> = {
  SPY: "S&P 500",
  QQQ: "Nasdaq",
  DIA: "Dow",
  TLT: "10Y",
  GLD: "Gold",
  USO: "Oil",
};

export function useMarketPulse() {
  const { quoteMap, error } = useQuotes(PULSE_TICKERS);

  const items: PulseItem[] = PULSE_TICKERS.map((t) => {
    const q = quoteMap.get(t);
    return {
      label: LABELS[t],
      ticker: t,
      value: q?.price ? `$${q.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
      chg: q?.changePct ?? 0,
    };
  });

  const isLoading = PULSE_TICKERS.every((t) => !quoteMap.get(t));

  return { items, isLoading, error };
}

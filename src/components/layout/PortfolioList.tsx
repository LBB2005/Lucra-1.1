"use client";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useQuotes } from "@/hooks/useQuotes";
import HoldingCard from "./HoldingCard";

const CHART_COLORS = ["#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#d1fae5", "#ecfdf5"];

export default function PortfolioList() {
  const { holdings, isLoading, removeHolding } = usePortfolio();
  const tickers = holdings.map((h) => h.ticker);
  const { quoteMap } = useQuotes(tickers);

  const totalValue = holdings.reduce((sum, h) => {
    const price = quoteMap.get(h.ticker)?.price ?? 0;
    return sum + (price > 0 ? price * h.shares : h.avgCost * h.shares);
  }, 0);

  const totalCost = holdings.reduce((sum, h) => sum + h.avgCost * h.shares, 0);
  const totalGainPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
  const isUp = totalGainPct >= 0;

  if (isLoading) return <div className="px-4 py-3 text-xs text-[var(--color-muted)]">Loading…</div>;

  if (holdings.length === 0) {
    return (
      <div className="px-4 py-3 text-center">
        <p className="text-xs text-[var(--color-muted)]">No holdings yet — use + to add</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-2">
      {/* Summary */}
      <div className="px-4 pt-1 pb-2">
        <div className="flex items-baseline justify-between mb-1.5">
          <p className="text-sm font-bold text-[var(--color-text)]">
            ${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
          <span className={`text-[11px] font-semibold ${isUp ? "text-emerald-600" : "text-red-500"}`}>
            {isUp ? "+" : ""}{totalGainPct.toFixed(1)}%
          </span>
        </div>
        {/* Allocation bar */}
        <div className="flex h-[4px] rounded-full overflow-hidden gap-[2px]">
          {holdings.map((h, i) => {
            const price = quoteMap.get(h.ticker)?.price ?? h.avgCost;
            const mv = price * h.shares;
            const pct = totalValue > 0 ? (mv / totalValue) * 100 : 0;
            return (
              <div
                key={h.ticker}
                style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                title={`${h.ticker}: ${pct.toFixed(1)}%`}
                className="rounded-full"
              />
            );
          })}
        </div>
      </div>

      {/* Holdings */}
      <div className="px-1">
        {holdings.map((h) => {
          const quote = quoteMap.get(h.ticker);
          const price = quote?.price ?? 0;
          const mv = price > 0 ? price * h.shares : h.avgCost * h.shares;
          const pct = totalValue > 0 ? (mv / totalValue) * 100 : 0;
          return (
            <HoldingCard key={h.id} holding={h} quote={quote} portfolioPct={pct} onRemove={removeHolding} />
          );
        })}
      </div>
    </div>
  );
}

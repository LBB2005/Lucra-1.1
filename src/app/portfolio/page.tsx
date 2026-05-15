"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useQuotes } from "@/hooks/useQuotes";
import { useChatStore } from "@/stores/chatStore";
import type { Holding, Quote } from "@/types/portfolio";

const SEGMENT_COLORS = ["#1a4b8f", "#2563c4", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#7c3aed", "#a78bfa"];

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

// SVG donut chart helpers
function polarXY(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as [number, number];
}

function arcPath(cx: number, cy: number, or: number, ir: number, a1: number, a2: number) {
  const span = a2 - a1;
  // For very small segments don't try to render
  if (span < 0.5) return "";
  const [x1, y1] = polarXY(cx, cy, or, a1);
  const [x2, y2] = polarXY(cx, cy, or, a2);
  const [x3, y3] = polarXY(cx, cy, ir, a2);
  const [x4, y4] = polarXY(cx, cy, ir, a1);
  const large = span > 180 ? 1 : 0;
  return `M${x1},${y1}A${or},${or} 0 ${large},1 ${x2},${y2}L${x3},${y3}A${ir},${ir} 0 ${large},0 ${x4},${y4}Z`;
}

interface HoldingRow {
  holding: Holding;
  quote?: Quote;
  mv: number;
  pct: number;
  gainLoss: number;
  gainLossPct: number;
}

export default function PortfolioPage() {
  const router = useRouter();
  const { holdings, cashBalance, setCashBalance } = usePortfolio();
  const { quoteMap } = useQuotes(holdings.map((h) => h.ticker));
  const { setPendingMessage, reset } = useChatStore();
  const [askText, setAskText] = useState("");
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);
  const [editingCash, setEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState("");
  const cashInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCash && cashInputRef.current) cashInputRef.current.focus();
  }, [editingCash]);

  function startEditCash() {
    setCashInput(cashBalance > 0 ? String(cashBalance) : "");
    setEditingCash(true);
  }

  async function commitCash() {
    const val = parseFloat(cashInput.replace(/,/g, ""));
    if (!isNaN(val) && val >= 0) await setCashBalance(val);
    setEditingCash(false);
  }

  const rows: HoldingRow[] = holdings.map((h) => {
    const quote = quoteMap.get(h.ticker);
    const price = quote?.price ?? 0;
    const mv = price > 0 ? price * h.shares : h.avgCost * h.shares;
    const cost = h.avgCost * h.shares;
    const gainLoss = price > 0 ? mv - cost : 0;
    const gainLossPct = cost > 0 && price > 0 ? (gainLoss / cost) * 100 : 0;
    return { holding: h, quote, mv, pct: 0, gainLoss, gainLossPct };
  });

  const totalValue = rows.reduce((s, r) => s + r.mv, 0);
  const totalCost = holdings.reduce((s, h) => s + h.avgCost * h.shares, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  rows.forEach((r) => { r.pct = totalValue > 0 ? (r.mv / totalValue) * 100 : 0; });

  // Build donut segments — 3° gap between each slice for clean separation
  const GAP = rows.length > 1 ? 3 : 0;
  let angle = 0;
  const segments = rows.map((r, i) => {
    const sweep = Math.max((r.pct / 100) * 360 - GAP, 0.5);
    const seg = {
      path: arcPath(90, 90, 82, 52, angle, angle + sweep),
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
      ticker: r.holding.ticker,
      pct: r.pct,
    };
    angle += sweep + GAP;
    return seg;
  });

  const maxAbsGain = Math.max(...rows.map((r) => Math.abs(r.gainLossPct)), 1);

  function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!askText.trim()) return;
    reset();
    setPendingMessage(askText.trim());
    router.push("/chat");
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[var(--color-border)] px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/chat")}
            className="text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors duration-150"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-[var(--color-text)]">Portfolio</h1>
        </div>
        <div className="flex items-center gap-6 text-right">
          {/* Buying power */}
          <div
            className="cursor-pointer group"
            onClick={startEditCash}
            title="Click to update buying power"
          >
            {editingCash ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-[var(--color-muted)]">$</span>
                <input
                  ref={cashInputRef}
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  onBlur={commitCash}
                  onKeyDown={(e) => { if (e.key === "Enter") commitCash(); if (e.key === "Escape") setEditingCash(false); }}
                  className="w-28 text-sm font-semibold text-[var(--color-text)] bg-transparent border-b border-[var(--color-accent)] focus:outline-none text-right"
                  placeholder="0.00"
                />
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                  ${cashBalance > 0 ? fmt(cashBalance, 2) : "—"}
                </p>
                <p className="text-[11px] text-[var(--color-muted)]">buying power</p>
              </>
            )}
          </div>
          <div>
            <p className="text-xl font-bold text-[var(--color-text)]">
              ${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-[var(--color-muted)]">{holdings.length} positions</p>
          </div>
          <div className={totalGain >= 0 ? "text-emerald-600" : "text-red-500"}>
            <p className="text-sm font-semibold">{totalGain >= 0 ? "+" : ""}${fmt(Math.abs(totalGain), 0)}</p>
            <p className="text-[11px]">{totalGain >= 0 ? "+" : ""}{fmt(totalGainPct, 1)}% total</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {holdings.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--color-muted)] text-sm">
            No holdings yet — add one from the sidebar
          </div>
        ) : (
          <div className="max-w-[1100px] mx-auto px-8 py-6 flex flex-col gap-6">
            {/* Charts row */}
            <div className="grid grid-cols-2 gap-5">
              {/* Allocation donut */}
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)] mb-4">Allocation</p>
                <div className="flex items-start gap-5">
                  <svg width="180" height="180" viewBox="0 0 180 180" className="flex-shrink-0">
                    {segments.map((seg) => (
                      <path
                        key={seg.ticker}
                        d={seg.path}
                        fill={seg.color}
                        opacity={hoveredTicker && hoveredTicker !== seg.ticker ? 0.25 : 1}
                        className="transition-opacity duration-150 cursor-pointer"
                        style={{ filter: hoveredTicker === seg.ticker ? "brightness(1.08)" : undefined }}
                        onMouseEnter={() => setHoveredTicker(seg.ticker)}
                        onMouseLeave={() => setHoveredTicker(null)}
                      />
                    ))}
                    {/* Center label */}
                    <text x="90" y="83" textAnchor="middle" fontSize="10" fill="#94a3b8" fontWeight="500" letterSpacing="0.04em">TOTAL</text>
                    <text x="90" y="101" textAnchor="middle" fontSize="16" fontWeight="700" fill="#0f172a">
                      ${totalValue >= 1000 ? fmt(totalValue / 1000, 1) + "k" : fmt(totalValue, 0)}
                    </text>
                  </svg>
                  {/* Legend */}
                  <div className="flex flex-col gap-2.5 pt-1 min-w-0">
                    {rows.map((r, i) => (
                      <div
                        key={r.holding.ticker}
                        className={`flex items-center gap-2 cursor-default rounded-lg px-2 py-1 -mx-2 transition-colors duration-100 ${hoveredTicker === r.holding.ticker ? "bg-[var(--color-accent-light)]" : ""}`}
                        onMouseEnter={() => setHoveredTicker(r.holding.ticker)}
                        onMouseLeave={() => setHoveredTicker(null)}
                      >
                        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
                        <span className="text-[11px] font-bold text-[var(--color-text)] w-11">{r.holding.ticker}</span>
                        <span className="text-[11px] text-[var(--color-muted)]">{fmt(r.pct, 1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* P&L performance bars */}
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)] mb-4">Performance</p>
                <div className="flex flex-col gap-2.5">
                  {rows.map((r) => {
                    const isPos = r.gainLossPct >= 0;
                    const barW = Math.max(Math.abs(r.gainLossPct) / maxAbsGain * 100, 2);
                    return (
                      <div key={r.holding.ticker} className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-[var(--color-accent)] w-12 text-right flex-shrink-0">{r.holding.ticker}</span>
                        <div className="flex-1 relative h-5 flex items-center">
                          <div
                            className="h-full rounded-md transition-all duration-500 ease-out"
                            style={{
                              width: `${barW}%`,
                              background: isPos
                                ? "linear-gradient(90deg, #10b981, #059669)"
                                : "linear-gradient(90deg, #f87171, #ef4444)",
                            }}
                          />
                        </div>
                        <span className={`text-[11px] font-semibold w-14 text-right flex-shrink-0 ${isPos ? "text-emerald-600" : "text-red-500"}`}>
                          {isPos ? "+" : ""}{fmt(r.gainLossPct, 1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Zero baseline note */}
                <p className="text-[10px] text-[var(--color-muted)] mt-4 text-center">Return since avg cost</p>
              </div>
            </div>

            {/* Holdings table */}
            <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden">
              <div className="bg-[var(--color-surface)] px-5 py-3 border-b border-[var(--color-border)]">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">Holdings</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                    {["Ticker", "Company", "Shares", "Price", "Mkt Value", "Cost Basis", "Gain/Loss", "P&L %", "Alloc"].map((h) => (
                      <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const cost = r.holding.avgCost * r.holding.shares;
                    const isPos = r.gainLoss >= 0;
                    return (
                      <tr key={r.holding.ticker} className={`border-b border-[var(--color-border)] hover:bg-[var(--color-accent-light)] transition-colors duration-100 ${idx % 2 === 0 ? "" : "bg-[var(--color-surface)]"}`}>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-[var(--color-accent)] bg-[var(--color-accent-light)] px-2 py-0.5 rounded">
                            {r.holding.ticker}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{r.holding.companyName ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text)]">{fmt(r.holding.shares, r.holding.shares % 1 === 0 ? 0 : 2)}</td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text)]">{r.quote?.price ? `$${fmt(r.quote.price)}` : "—"}</td>
                        <td className="px-4 py-3 text-xs font-medium text-[var(--color-text)]">${fmt(r.mv, 0)}</td>
                        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">${fmt(cost, 0)}</td>
                        <td className={`px-4 py-3 text-xs font-medium ${isPos ? "text-emerald-600" : "text-red-500"}`}>
                          {isPos ? "+" : ""}${fmt(Math.abs(r.gainLoss), 0)}
                        </td>
                        <td className={`px-4 py-3 text-xs font-semibold ${isPos ? "text-emerald-600" : "text-red-500"}`}>
                          {isPos ? "+" : ""}{fmt(r.gainLossPct, 1)}%
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{fmt(r.pct, 1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Ask bar */}
      <div
        className="flex-shrink-0 px-8 pb-6 pt-3"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, #ffffff 28%)" }}
      >
        <form onSubmit={handleAsk} className="max-w-[740px] mx-auto">
          <div className="relative flex rounded-2xl border border-[var(--color-border)] bg-white shadow-[0_1px_6px_rgba(0,0,0,0.05)] focus-within:border-slate-300 focus-within:shadow-[0_2px_18px_rgba(0,0,0,0.07)] transition-all duration-200">
            <input
              type="text"
              value={askText}
              onChange={(e) => setAskText(e.target.value)}
              placeholder="Ask AI about this portfolio…"
              className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none py-3.5 pl-4 pr-11 leading-relaxed"
            />
            <button
              type="submit"
              className="absolute right-3 bottom-3 w-7 h-7 rounded-full flex items-center justify-center bg-[var(--color-accent)] text-white hover:opacity-80 transition-opacity duration-150 shadow-sm"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
          <p className="text-center text-[10px] text-[var(--color-muted)] mt-2 tracking-wide">
            Sends to Chat with your portfolio context
          </p>
        </form>
      </div>
    </div>
  );
}

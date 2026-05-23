"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { useChatStore } from "@/stores/chatStore";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useQuotes } from "@/hooks/useQuotes";
import ConversationList from "./ConversationList";
import PortfolioList from "./PortfolioList";
import AddHoldingModal from "@/components/portfolio/AddHoldingModal";
import CsvUploadModal from "@/components/portfolio/CsvUploadModal";
import StatementUploadModal from "@/components/portfolio/StatementUploadModal";
import BriefingModal from "@/components/briefing/BriefingModal";
import type { HoldingFormData } from "@/types/portfolio";

interface BriefingSummary {
  id: string;
  tickers: string[];
  readAt: string | null;
  createdAt: string;
  content: string;
}

import { authFetch, authFetcher } from "@/lib/authFetch";
const fetcher = authFetcher;

function BriefingBanner() {
  const { data: briefings, mutate } = useSWR<BriefingSummary[]>("/api/briefing", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const [generating, setGenerating] = useState(false);
  const [openBriefing, setOpenBriefing] = useState<BriefingSummary | null>(null);

  const latest = briefings?.[0] ?? null;
  const hasUnread = latest && !latest.readAt;

  async function generate() {
    setGenerating(true);
    try {
      const res = await authFetch("/api/briefing/generate", { method: "POST" });
      if (res.ok) await mutate();
    } finally {
      setGenerating(false);
    }
  }

  async function openLatest() {
    if (!latest) return;
    setOpenBriefing(latest);
    if (!latest.readAt) {
      await authFetch("/api/briefing", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: latest.id }) });
      await mutate();
    }
  }

  return (
    <>
      <div
        className="mx-[14px] mb-2 flex-shrink-0"
        style={{
          border: `1px solid ${hasUnread ? "var(--color-accent-medium)" : "var(--color-border)"}`,
          background: hasUnread ? "var(--color-accent-light)" : "var(--color-surface)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
            style={{ color: hasUnread ? "var(--color-accent)" : "var(--color-muted)", flexShrink: 0 }}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <span
            className="flex-1 text-[11px] font-semibold truncate"
            style={{ color: hasUnread ? "var(--color-accent)" : "var(--color-text-secondary)" }}
          >
            {hasUnread ? "New briefing ready" : latest ? "Weekly Briefing" : "No briefing yet"}
          </span>
          {hasUnread && (
            <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: "var(--color-accent)" }} />
          )}
        </div>
        <div className="flex border-t border-[var(--color-border)]">
          {latest && (
            <button
              onClick={openLatest}
              className="flex-1 text-[10.5px] font-medium py-1.5 transition-colors duration-100"
              style={{ color: "var(--color-accent)", background: "transparent" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-accent-light)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              Read
            </button>
          )}
          {latest && <div style={{ width: 1, background: "var(--color-border)" }} />}
          <button
            onClick={generate}
            disabled={generating}
            className="flex-1 text-[10.5px] font-medium py-1.5 transition-colors duration-100 disabled:opacity-50"
            style={{ color: "var(--color-text-secondary)", background: "transparent" }}
            onMouseEnter={(e) => { if (!generating) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-2)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            {generating ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>

      {openBriefing && (
        <BriefingModal briefing={openBriefing} onClose={() => setOpenBriefing(null)} />
      )}
    </>
  );
}

const MIN_WIDTH = 220;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 268;

function fmt(n: number, d = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Allocation bar using the same oklch colour ramp as the design */
function allocColor(i: number) {
  const l = Math.max(0.2, 0.55 - i * 0.04);
  const c = 0.13;
  const h = 250 - i * 12;
  return `oklch(${l} ${c} ${h})`;
}

function PortfolioHero() {
  const { holdings } = usePortfolio();
  const { quoteMap } = useQuotes(holdings.map((h) => h.ticker));

  const totalValue = holdings.reduce((sum, h) => {
    const p = quoteMap.get(h.ticker)?.price ?? 0;
    return sum + (p > 0 ? p * h.shares : h.avgCost * h.shares);
  }, 0);

  const totalCost = holdings.reduce((sum, h) => sum + h.avgCost * h.shares, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const isUp = totalGain >= 0;

  // Weights for alloc bar
  const weights = holdings.map((h) => {
    const p = quoteMap.get(h.ticker)?.price ?? 0;
    const mv = p > 0 ? p * h.shares : h.avgCost * h.shares;
    return totalValue > 0 ? (mv / totalValue) * 100 : 0;
  });

  if (holdings.length === 0) return null;

  return (
    <div
      className="flex-shrink-0 border-t border-b border-[var(--color-border)] px-[18px] py-[14px]"
      style={{
        background: "linear-gradient(180deg, color-mix(in oklab, var(--color-accent) 4%, transparent), transparent)",
      }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)] mb-2"
      >
        Portfolio
      </p>

      {/* Serif total */}
      <p
        className="text-[24px] font-bold leading-none tracking-tight text-[var(--color-text)]"
        style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.01em" }}
      >
        ${fmt(totalValue)}
      </p>

      {/* Delta */}
      <div className="flex items-center justify-between mt-1.5">
        <span
          className="text-[12px] font-semibold"
          style={{ color: isUp ? "var(--color-bull)" : "var(--color-bear)" }}
        >
          {isUp ? "▲" : "▼"} ${fmt(Math.abs(totalGain))} · {isUp ? "+" : ""}
          {totalGainPct.toFixed(2)}%
        </span>
        <span className="text-[10.5px] text-[var(--color-muted)] tracking-[0.08em]">ALL-TIME</span>
      </div>

      {/* Alloc bar */}
      {weights.length > 0 && (
        <div className="flex h-[4px] rounded-full overflow-hidden mt-3 gap-[2px]">
          {weights.map((w, i) => (
            <div
              key={holdings[i]?.ticker ?? i}
              style={{ width: `${w}%`, background: allocColor(i) }}
              title={`${holdings[i]?.ticker} ${w.toFixed(1)}%`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [portfolioOpen, setPortfolioOpen] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const reset = useChatStore((s) => s.reset);
  const streamingConversationId = useChatStore((s) => s.streamingConversationId);
  const conversationId = useChatStore((s) => s.conversationId);
  const hasBackgroundStream = !!streamingConversationId && streamingConversationId !== conversationId;
  const { addHolding, uploadCsv, setCashBalance } = usePortfolio();

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth.current + e.clientX - startX.current)));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const isOnPortfolio = pathname === "/portfolio";
  const isOnHedgeFund = pathname === "/hedge-fund";

  return (
    <aside
      className="relative flex flex-col h-full flex-shrink-0 overflow-hidden"
      style={{
        width,
        background: "var(--color-sidebar)",
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {/* Brand row */}
      <div className="flex items-center justify-between px-[18px] pt-5 pb-[14px] flex-shrink-0">
        <span
          className="text-[22px] font-black uppercase leading-none select-none text-[var(--color-text)]"
          style={{ fontFamily: "var(--font-serif)", letterSpacing: "0.16em" }}
        >
          LUCRA
        </span>
        <button
          onClick={reset}
          title="New chat"
          className="w-[26px] h-[26px] flex items-center justify-center rounded-[7px] text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-colors duration-150"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Nav pill — Chat + Portfolio */}
      <div
        className="flex gap-1 mx-[14px] mb-[6px] p-[3px] flex-shrink-0"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: isOnHedgeFund ? "4px" : "10px",
        }}
      >
        <Link
          href="/chat"
          className="flex-1 text-center text-[12px] font-medium py-[5px] transition-all duration-150 relative"
          style={
            !isOnPortfolio && !isOnHedgeFund
              ? {
                  background: "var(--color-bg)",
                  color: "var(--color-accent)",
                  boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
                  fontWeight: 600,
                  borderRadius: isOnHedgeFund ? "2px" : "7px",
                }
              : { color: "var(--color-text-secondary)", borderRadius: isOnHedgeFund ? "2px" : "7px" }
          }
        >
          Chat
          {hasBackgroundStream && (
            <span
              className="absolute top-[4px] right-[10px] inline-flex w-[7px] h-[7px] rounded-full"
              style={{ background: "var(--color-accent)", boxShadow: "0 0 0 2px color-mix(in oklab, var(--color-accent) 25%, transparent)", animation: "pulse-dot 1.4s infinite ease-in-out" }}
            />
          )}
        </Link>
        <Link
          href="/portfolio"
          className="flex-1 text-center text-[12px] font-medium py-[5px] transition-all duration-150"
          style={
            isOnPortfolio
              ? {
                  background: "var(--color-bg)",
                  color: "var(--color-accent)",
                  boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
                  fontWeight: 600,
                  borderRadius: isOnHedgeFund ? "2px" : "7px",
                }
              : { color: "var(--color-text-secondary)", borderRadius: isOnHedgeFund ? "2px" : "7px" }
          }
        >
          Portfolio
        </Link>
      </div>

      {/* Hedge Fund nav button */}
      <Link
        href="/hedge-fund"
        className="flex items-center gap-[6px] mx-[14px] mb-3 px-[10px] py-[6px] text-[12px] font-medium transition-all duration-150 flex-shrink-0"
        style={
          isOnHedgeFund
            ? {
                background: "var(--color-accent)",
                color: "#fff",
                border: "1px solid var(--color-accent)",
                borderRadius: "4px",
                fontWeight: 600,
              }
            : {
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                borderRadius: "7px",
              }
        }
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
        Hedge Fund
      </Link>

      {/* Weekly briefing banner */}
      <BriefingBanner />

      {/* Portfolio hero */}
      <PortfolioHero />

      {/* Holdings section header */}
      <div
        className="flex items-center px-[18px] py-[10px] flex-shrink-0"
        style={{ borderBottom: portfolioOpen ? "none" : "1px solid var(--color-border)" }}
      >
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Holdings
        </span>

        {/* + dropdown */}
        <div className="relative" ref={addMenuRef}>
          <button
            onClick={() => setShowAddMenu((v) => !v)}
            className="w-[22px] h-[22px] flex items-center justify-center rounded text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-colors duration-150"
            title="Add holding"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          {showAddMenu && (
            <div className="absolute right-0 top-6 z-50 bg-white border border-[var(--color-border)] rounded-xl shadow-lg py-1 w-36 overflow-hidden">
              <button
                onClick={() => { setShowAdd(true); setShowAddMenu(false); }}
                className="w-full text-left px-3 py-2 text-xs text-[var(--color-text)] hover:bg-[var(--color-accent-light)] hover:text-[var(--color-accent)] transition-colors duration-100"
              >
                Add Stock
              </button>
              <button
                onClick={() => { setShowCsv(true); setShowAddMenu(false); }}
                className="w-full text-left px-3 py-2 text-xs text-[var(--color-text)] hover:bg-[var(--color-accent-light)] hover:text-[var(--color-accent)] transition-colors duration-100"
              >
                Import CSV
              </button>
              <button
                onClick={() => { setShowStatement(true); setShowAddMenu(false); }}
                className="w-full text-left px-3 py-2 text-xs text-[var(--color-text)] hover:bg-[var(--color-accent-light)] hover:text-[var(--color-accent)] transition-colors duration-100"
              >
                Upload Statement
              </button>
            </div>
          )}
        </div>

        {/* Collapse chevron */}
        <button
          onClick={() => setPortfolioOpen((v) => !v)}
          className="w-[22px] h-[22px] flex items-center justify-center rounded text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors duration-150"
        >
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`transition-transform duration-200 ${portfolioOpen ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {portfolioOpen && (
        <div className="overflow-y-auto flex-shrink-0" style={{ maxHeight: "32vh", borderBottom: "1px solid var(--color-border)" }}>
          <PortfolioList compact />
        </div>
      )}

      {/* Recent conversations */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1">
        <p className="px-[18px] pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Recent
        </p>
        <ConversationList />
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        className="absolute top-0 right-0 w-[5px] h-full cursor-col-resize z-10 group"
      >
        <div className="absolute right-0 top-0 w-[1px] h-full bg-[var(--color-border)] group-hover:w-[2px] group-hover:bg-[var(--color-accent-medium)] transition-all duration-150" />
      </div>

      {/* Modals */}
      {showAdd && (
        <AddHoldingModal
          onClose={() => setShowAdd(false)}
          onAdd={(data: HoldingFormData) =>
            addHolding({ ...data, companyName: data.companyName ?? null, sector: data.sector ?? null })
          }
        />
      )}
      {showCsv && <CsvUploadModal onClose={() => setShowCsv(false)} onUpload={uploadCsv} />}
      {showStatement && (
        <StatementUploadModal
          onClose={() => setShowStatement(false)}
          onAdd={async (holdings, buyingPower, replace) => {
            if (replace) {
              await authFetch("/api/portfolio", { method: "DELETE" });
            }
            for (const h of holdings) {
              await addHolding({ ticker: h.ticker, companyName: h.companyName ?? null, shares: h.shares, avgCost: h.avgCost ?? 0, sector: null });
            }
            if (buyingPower != null && buyingPower > 0) {
              await setCashBalance(buyingPower);
            }
          }}
        />
      )}
    </aside>
  );
}

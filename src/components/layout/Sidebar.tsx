"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChatStore } from "@/stores/chatStore";
import { usePortfolio } from "@/hooks/usePortfolio";
import ConversationList from "./ConversationList";
import PortfolioList from "./PortfolioList";
import AddHoldingModal from "@/components/portfolio/AddHoldingModal";
import CsvUploadModal from "@/components/portfolio/CsvUploadModal";
import StatementUploadModal from "@/components/portfolio/StatementUploadModal";
import type { HoldingFormData } from "@/types/portfolio";

const MIN_WIDTH = 220;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 300;

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
  const { addHolding, uploadCsv } = usePortfolio();

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

  // Close add menu on outside click
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

  return (
    <aside
      className="relative flex flex-col h-full bg-[var(--color-sidebar)] border-r border-[var(--color-border)] flex-shrink-0"
      style={{ width }}
    >
      {/* Brand + New Chat */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
        <span
          className="text-[17px] font-black uppercase tracking-[0.18em] text-[var(--color-text)] select-none"
          style={{ fontFamily: "var(--font-playfair), Georgia, 'Times New Roman', serif" }}
        >
          LUCRA
        </span>
        <button
          onClick={reset}
          title="New chat"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-colors duration-150"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Nav pill: Chat | Portfolio */}
      <div className="px-3 pb-2 flex gap-1 flex-shrink-0">
        <Link
          href="/chat"
          className={`flex-1 text-center text-[11px] font-medium py-1.5 rounded-lg transition-colors duration-150 ${
            !isOnPortfolio
              ? "bg-[var(--color-accent)] text-white"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-sidebar-hover)]"
          }`}
        >
          Chat
        </Link>
        <Link
          href="/portfolio"
          className={`flex-1 text-center text-[11px] font-medium py-1.5 rounded-lg transition-colors duration-150 ${
            isOnPortfolio
              ? "bg-[var(--color-accent)] text-white"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-sidebar-hover)]"
          }`}
        >
          Portfolio
        </Link>
      </div>

      {/* Portfolio section */}
      <div className="flex-shrink-0 border-t border-b border-[var(--color-border)]">
        <div className="flex items-center px-4 py-2 gap-1">
          <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
            Holdings
          </span>

          {/* + dropdown */}
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => setShowAddMenu((v) => !v)}
              className="w-5 h-5 flex items-center justify-center rounded text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-colors duration-150"
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
            className="w-5 h-5 flex items-center justify-center rounded text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors duration-150"
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
          <div className="overflow-y-auto" style={{ maxHeight: "42vh" }}>
            <PortfolioList />
          </div>
        )}
      </div>

      {/* Recent conversations */}
      <div className="flex-1 overflow-y-auto px-2 min-h-0 py-1">
        <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
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
          onAdd={async (holdings) => {
            for (const h of holdings) {
              await addHolding({ ticker: h.ticker, companyName: h.companyName ?? null, shares: h.shares, avgCost: h.avgCost ?? 0, sector: null });
            }
          }}
        />
      )}
    </aside>
  );
}

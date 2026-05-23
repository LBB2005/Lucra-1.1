"use client";
import type { HFTab, BotSection } from "./types";

const TABS: { id: HFTab; label: string }[] = [
  { id: "overview",   label: "Overview"   },
  { id: "strategies", label: "Strategies" },
  { id: "trading",    label: "Trading"    },
  { id: "bot",        label: "Bot"        },
];

function fmt(n: number, d = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

interface Props {
  activeTab: HFTab;
  onTab: (t: HFTab) => void;
  bot: BotSection;
  nav?: number;
  dayPnL?: number;
  isLive?: boolean;
}

export function HFSubnav({ activeTab, onTab, bot, nav = 124820, dayPnL = 2154, isLive = false }: Props) {
  const isRunning = bot.status === "Running";
  return (
    <nav className="hf-subnav">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`hf-tab${activeTab === t.id ? " active" : ""}`}
          onClick={() => onTab(t.id)}
        >
          {t.label}
        </button>
      ))}

      <div className="hf-grow" />

      {/* Bot status chip */}
      <span className="hf-stat-chip">
        {isRunning
          ? <span className="chip-pulse" />
          : <span style={{ width: 6, height: 6, borderRadius: "99px", background: "var(--color-muted)", display: "inline-block" }} />
        }
        <span className="chip-label">BOT</span>
        <span style={{ color: isRunning ? "var(--color-bull)" : "var(--color-muted)", fontWeight: 600 }}>
          {bot.status}
        </span>
      </span>

      {/* NAV */}
      <span className="hf-stat-chip">
        <span className="chip-label">NAV</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>${fmt(nav)}</span>
      </span>

      {/* Day P&L */}
      <span className="hf-stat-chip">
        <span className="chip-label">DAY</span>
        <span className={dayPnL >= 0 ? "hf-up" : "hf-down"} style={{ fontWeight: 600 }}>
          {dayPnL >= 0 ? "+" : ""}${fmt(Math.abs(dayPnL))}
        </span>
      </span>

      {/* Live / Demo data badge */}
      <span
        className="hf-stat-chip"
        style={{
          background: isLive ? "color-mix(in oklab, var(--color-bull) 12%, transparent)" : "var(--color-surface-2)",
          borderColor: isLive ? "color-mix(in oklab, var(--color-bull) 30%, transparent)" : "var(--color-border)",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "99px", background: isLive ? "var(--color-bull)" : "var(--color-muted)", display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: "9.5px", letterSpacing: "0.12em", color: isLive ? "var(--color-bull)" : "var(--color-muted)" }}>
          {isLive ? "LIVE" : "DEMO"}
        </span>
      </span>
    </nav>
  );
}

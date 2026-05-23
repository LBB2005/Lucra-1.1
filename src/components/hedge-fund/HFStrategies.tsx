"use client";
import { useState } from "react";
import { mutate } from "swr";
import { authFetch } from "@/lib/authFetch";

import type { Strategy, StrategyConfig, StrategyTag, MarkovSection } from "./types";
import { HFMarkov } from "./HFMarkov";
import Markdown from "@/components/chat/Markdown";

function TagBadge({ tag }: { tag: StrategyTag }) {
  const cls =
    tag === "Live"  ? "hf-tag hf-tag-live"  :
    tag === "Paper" ? "hf-tag hf-tag-paper" :
                      "hf-tag hf-tag-draft";
  return <span className={cls}>{tag}</span>;
}

function StatCol({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="hf-stat-col">
      <div className="stat-l">{label}</div>
      <div className="stat-v" style={{ color: color ?? "var(--color-text)" }}>{value}</div>
    </div>
  );
}

// ── Config parameter grid ─────────────────────────────────────────────────────

const CONFIG_LABELS: Record<string, string> = {
  mode:                   "Mode",
  regime_ticker:          "Regime ticker",
  signal_ticker:          "Signal ticker",
  instrument_long:        "Long instrument",
  instrument_short:       "Short instrument",
  orb_window_minutes:     "ORB window (min)",
  capture_time_et:        "Capture time (ET)",
  flatten_time_et:        "Flatten time (ET)",
  position_pct:           "Position size",
  profit_target_pct:      "Take-profit",
  stop_loss_pct:          "Stop-loss",
  max_daily_drawdown_pct: "Daily DD limit",
  tickers:                "Tickers",
  bull_equity_pct:        "Bull allocation",
  sideways_equity_pct:    "Sideways allocation",
  bear_equity_pct:        "Bear allocation",
  momentum_short:         "Short MA (days)",
  momentum_long:          "Long MA (days)",
  hmm_bull_threshold:     "HMM Bull threshold",
  trailing_stop_pct:      "Trailing stop",
  dte:                    "DTE",
  width_sd:               "Strike width (SD)",
  close_at_credit_pct:    "Close at credit %",
  vix_threshold:          "VIX threshold",
  bull_persistence_threshold: "Bull persistence",
  hold_days:              "Hold days",
  stop_pct:               "Stop",
  entry:                  "Entry",
  universe:               "Universe",
};

function formatConfigValue(key: string, val: unknown): string {
  if (typeof val === "number") {
    if (key.endsWith("_pct")) return `${(val * 100).toFixed(0)}%`;
    return String(val);
  }
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

function StrategyConfigPanel({ config }: { config: StrategyConfig }) {
  const entries = Object.entries(config).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (entries.length === 0) return null;

  return (
    <div className="hf-card" style={{ padding: 0 }}>
      <div className="hf-card-head">
        <span className="hf-card-title">Bot configuration</span>
        <span className="hf-card-meta">Parameters the bot reads at runtime</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 0 }}>
        {entries.map(([key, val]) => (
          <div
            key={key}
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--color-border)",
              borderRight: "1px solid var(--color-border)",
            }}
          >
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 3 }}>
              {CONFIG_LABELS[key] ?? key}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>
              {formatConfigValue(key, val)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Research notes ────────────────────────────────────────────────────────────

function StrategyResearch({ research }: { research: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="hf-card" style={{ padding: 0 }}>
      <div
        className="hf-card-head"
        style={{ cursor: "pointer" }}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="hf-card-title">Research &amp; rationale</span>
        <div className="hf-grow" />
        <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{open ? "▲ collapse" : "▼ expand"}</span>
      </div>
      {open && (
        <div style={{ padding: "4px 16px 16px", fontSize: 13, lineHeight: 1.7 }}>
          <Markdown>{research}</Markdown>
        </div>
      )}
    </div>
  );
}

// ── Single-strategy detail view ───────────────────────────────────────────────

function StrategyDetail({
  strategy,
  markov,
  markovLoading,
  markovError,
  onBack,
  onToggle,
  onDelete,
}: {
  strategy: Strategy;
  markov?: MarkovSection;
  markovLoading?: boolean;
  markovError?: string | null;
  onBack: () => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div>
        <button className="hf-btn hf-btn-ghost" onClick={onBack} style={{ marginBottom: 10 }}>
          ← All strategies
        </button>
        <div className="hf-eyebrow">Strategy detail</div>
        <h2 className="hf-headline" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {strategy.name}
          <TagBadge tag={strategy.tag} />
        </h2>
        <p className="hf-dek">{strategy.desc}</p>
        {strategy.tickers.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {strategy.tickers.map((t) => (
              <span key={t} className="tk-chip">{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="hf-strip">
        <StatCol
          label="Sharpe"
          value={strategy.sharpe.toFixed(2)}
          color={strategy.sharpe > 0.7 ? "var(--color-bull)" : "var(--color-warn)"}
        />
        <StatCol label="CAGR"   value={`+${strategy.cagr.toFixed(1)}%`}   color="var(--color-bull)" />
        <StatCol label="Max DD" value={`${strategy.maxDD.toFixed(1)}%`}    color="var(--color-bear)" />
        <StatCol label="Win %"  value={`${strategy.winRate.toFixed(1)}%`} />
      </div>

      {strategy.tickers.some((t) => markov?.tickers.some((m) => m.ticker === t)) && markov && (
        <HFMarkov
          markov={markov}
          isLoading={markovLoading}
          error={markovError}
        />
      )}

      <StrategyConfigPanel config={strategy.config} />

      {strategy.research && <StrategyResearch research={strategy.research} />}

      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
        <button
          className={strategy.active ? "hf-btn" : "hf-btn hf-btn-primary"}
          onClick={() => onToggle(strategy.id)}
        >
          {strategy.active ? "Pause strategy" : "Activate strategy"}
        </button>
        <span style={{ fontSize: 11, color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>
          Last: {strategy.lastTrade}
        </span>
        <div className="hf-grow" />
        <button
          className="hf-btn hf-btn-danger"
          onClick={() => onDelete(strategy.id)}
        >
          Delete
        </button>
      </div>
    </>
  );
}

// ── Inline add-strategy form ──────────────────────────────────────────────────

const BLANK_DRAFT = { name: "", tag: "Draft" as StrategyTag, desc: "", tickers: "" };

function AddForm({ onAdd, onCancel }: { onAdd: (s: Strategy) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(BLANK_DRAFT);

  function submit() {
    if (!draft.name.trim()) return;
    const tickers = draft.tickers
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    onAdd({
      id:        `user-${Date.now()}`,
      name:      draft.name.trim(),
      tag:       draft.tag,
      desc:      draft.desc.trim() || "No description.",
      tickers,
      config:    {},
      research:  "",
      sharpe:    0,
      cagr:      0,
      maxDD:     0,
      winRate:   0,
      active:    false,
      lastTrade: "—",
    });
  }

  return (
    <div
      style={{
        padding: "14px 14px 16px",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8 }}>
        <input
          className="hf-input"
          placeholder="Strategy name"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        <select
          className="hf-input"
          value={draft.tag}
          onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value as StrategyTag }))}
          style={{ cursor: "pointer" }}
        >
          <option value="Draft">Draft</option>
          <option value="Paper">Paper</option>
          <option value="Live">Live</option>
        </select>
      </div>
      <input
        className="hf-input"
        placeholder="Tickers (comma-separated, e.g. SPY, QQQ, NVDA)"
        value={draft.tickers}
        onChange={(e) => setDraft((d) => ({ ...d, tickers: e.target.value }))}
      />
      <textarea
        className="hf-input"
        placeholder="Description (optional)"
        value={draft.desc}
        onChange={(e) => setDraft((d) => ({ ...d, desc: e.target.value }))}
        style={{ resize: "vertical", minHeight: 58, fontFamily: "var(--font-sans)", fontSize: 12 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="hf-btn hf-btn-primary"
          disabled={!draft.name.trim()}
          onClick={submit}
        >
          Add strategy
        </button>
        <button className="hf-btn hf-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── Strategy list row ─────────────────────────────────────────────────────────

function StrategyRow({
  strategy,
  editMode,
  onToggle,
  onSelect,
  onDelete,
}: {
  strategy: Strategy;
  editMode: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="hf-strat-row" style={{ cursor: "pointer" }} onClick={() => onSelect(strategy.id)}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
            {strategy.name}
          </span>
          <TagBadge tag={strategy.tag} />
        </div>
        <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", lineHeight: 1.45 }}>
          {strategy.desc}
        </div>
        {strategy.tickers.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
            {strategy.tickers.map((t) => (
              <span key={t} className="tk-chip" style={{ fontSize: 10 }}>{t}</span>
            ))}
          </div>
        )}
      </div>

      <StatCol
        label="Sharpe"
        value={strategy.sharpe.toFixed(2)}
        color={strategy.sharpe > 0.7 ? "var(--color-bull)" : "var(--color-warn)"}
      />
      <StatCol label="CAGR"   value={`+${strategy.cagr.toFixed(1)}%`}   color="var(--color-bull)" />
      <StatCol label="Max DD" value={`${strategy.maxDD.toFixed(1)}%`}    color="var(--color-bear)" />
      <StatCol label="Win %"  value={`${strategy.winRate.toFixed(1)}%`} />

      <div
        style={{ display: "flex", alignItems: "center", gap: 6 }}
        onClick={(e) => e.stopPropagation()}
      >
        {strategy.active ? (
          <button className="hf-btn" onClick={() => onToggle(strategy.id)}>Pause</button>
        ) : (
          <button className="hf-btn hf-btn-primary" onClick={() => onToggle(strategy.id)}>Activate</button>
        )}
        {editMode && (
          <button
            className="hf-btn"
            style={{ color: "var(--color-bear)", padding: "4px 7px", fontSize: 13 }}
            title="Delete strategy"
            onClick={() => onDelete(strategy.id)}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  strategies: Strategy[];
  markov?: MarkovSection;
  markovLoading?: boolean;
  markovError?: string | null;
}

export function HFStrategies({
  strategies,
  markov,
  markovLoading,
  markovError,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew]       = useState(false);
  const [editMode, setEditMode]     = useState(false);

  const live  = strategies.filter((s) => s.tag === "Live").length;
  const paper = strategies.filter((s) => s.tag === "Paper").length;
  const draft = strategies.filter((s) => s.tag === "Draft").length;

  const selectedStrategy = selectedId
    ? (strategies.find((s) => s.id === selectedId) ?? null)
    : null;

  async function handleToggle(id: string) {
    const strategy = strategies.find((s) => s.id === id);
    if (!strategy) return;
    await authFetch(`/api/strategies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !strategy.active }),
    });
    await mutate("/api/strategies");
  }

  async function handleDelete(id: string) {
    await authFetch(`/api/strategies/${id}`, { method: "DELETE" });
    setSelectedId(null);
    await mutate("/api/strategies");
  }

  async function handleAdd(s: Strategy) {
    await authFetch("/api/strategies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:    s.name,
        tag:     s.tag,
        desc:    s.desc,
        tickers: s.tickers,
      }),
    });
    setShowNew(false);
    await mutate("/api/strategies");
  }

  return (
    <>
      <div>
        <div className="hf-eyebrow">
          {selectedStrategy
            ? `Strategy detail · ${selectedStrategy.name}`
            : `Strategy library · ${strategies.length} total · ${live} live · ${paper} paper · ${draft} draft`}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
          <h2 className="hf-headline" style={{ margin: 0 }}>Strategies</h2>
          <select
            value={selectedId ?? ""}
            onChange={(e) => { setSelectedId(e.target.value || null); setShowNew(false); }}
            style={{
              fontSize: 11.5,
              color: selectedId ? "var(--color-text)" : "var(--color-text-secondary)",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 7,
              padding: "4px 8px",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              outline: "none",
            }}
          >
            <option value="">All strategies ▾</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            className="hf-btn hf-btn-ghost"
            style={{
              opacity: selectedStrategy ? 1 : 0.4,
              pointerEvents: selectedStrategy ? "auto" : "none",
            }}
            title={selectedStrategy ? `Backtest ${selectedStrategy.name}` : "Select a strategy first"}
          >
            Backtest
          </button>
        </div>
        {!selectedStrategy && (
          <p className="hf-dek">
            Backtested walk-forward — no lookahead. One bot runs at a time. Activate a strategy to arm
            the bot. Click any row or use the dropdown to inspect details.
          </p>
        )}
      </div>

      {selectedStrategy ? (
        <StrategyDetail
          strategy={selectedStrategy}
          markov={markov}
          markovLoading={markovLoading}
          markovError={markovError}
          onBack={() => setSelectedId(null)}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      ) : (
        <div className="hf-card">
          <div className="hf-card-head">
            <span className="hf-card-title">All strategies</span>
            <div className="hf-grow" />
            <button className="hf-btn hf-btn-ghost">Filter</button>
            <button
              className="hf-btn hf-btn-ghost"
              style={{ color: editMode ? "var(--color-accent)" : undefined }}
              onClick={() => { setEditMode((v) => !v); setShowNew(false); }}
            >
              {editMode ? "Done" : "Edit"}
            </button>
            <button
              className="hf-btn hf-btn-primary"
              onClick={() => { setShowNew((v) => !v); setEditMode(false); }}
            >
              {showNew ? "Cancel" : "+ New"}
            </button>
          </div>

          {showNew && (
            <AddForm
              onAdd={handleAdd}
              onCancel={() => setShowNew(false)}
            />
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr repeat(4, auto) 100px",
              gap: 14,
              padding: "7px 14px",
              background: "var(--color-surface)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            {["Strategy", "Sharpe", "CAGR", "Max DD", "Win %", ""].map((h, i) => (
              <div
                key={i}
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--color-muted)",
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {strategies.map((s) => (
            <StrategyRow
              key={s.id}
              strategy={s}
              editMode={editMode}
              onToggle={handleToggle}
              onSelect={setSelectedId}
              onDelete={handleDelete}
            />
          ))}

          {strategies.length === 0 && (
            <div style={{ padding: "24px 14px", textAlign: "center", fontSize: 12, color: "var(--color-muted)" }}>
              No strategies yet. Click + New to add one.
            </div>
          )}
        </div>
      )}
    </>
  );
}

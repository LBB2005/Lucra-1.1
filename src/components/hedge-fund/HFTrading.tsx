"use client";
import { useState } from "react";
import type { TradingSection, Order, OrderSide, Regime } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, d = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtSigned(n: number, d = 2) {
  return (n >= 0 ? "+" : "") + n.toFixed(d);
}

function StatCell({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="hf-cell">
      <div className="hf-cell-label">{label}</div>
      <div className="hf-cell-value" style={{ color: accent ?? "var(--color-text)" }}>{value}</div>
      {sub && <div className="hf-cell-sub">{sub}</div>}
    </div>
  );
}

function SideBadge({ side }: { side: OrderSide }) {
  return (
    <span className={side === "BUY" ? "hf-side hf-side-buy" : "hf-side hf-side-sell"}>
      {side}
    </span>
  );
}

function StatusBadge({ status }: { status: Order["status"] }) {
  const cls =
    status === "Working" ? "hf-status hf-status-working" :
    status === "Partial"  ? "hf-status hf-status-partial"  :
    status === "Queued"   ? "hf-status hf-status-queued"   :
                            "hf-status";
  return <span className={cls}>{status}</span>;
}

function RegimePill({ signal }: { signal: Regime }) {
  return <span className={`hf-regime hf-regime-${signal.toLowerCase()}`}>{signal}</span>;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 600 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  trading: TradingSection;
}

export function HFTrading({ trading: tr }: Props) {
  const [side, setSide] = useState<OrderSide>("BUY");
  const [ticker, setTicker] = useState("NVDA");
  const [qty, setQty] = useState("25");
  const [orderType, setOrderType] = useState("LMT");
  const [limitPx, setLimitPx] = useState("405.50");
  const [tif, setTif] = useState("DAY");

  const estValue = parseFloat(qty || "0") * parseFloat(limitPx || "0");

  return (
    <>
      {/* 4-up strip */}
      <div className="hf-strip">
        <StatCell label="Buying Power"  value={`$${fmt(tr.buyingPower)}`}   sub="Cash · Margin available" />
        <StatCell label="Day P&L"       value={fmtSigned(tr.dayPnL, 0)}      sub={`${fmtSigned(tr.dayPnLPct)}%`} accent="var(--color-bull)" />
        <StatCell label="Open Orders"   value={String(tr.openOrders.length)} sub="Working + queued" />
        <StatCell label="Fills Today"   value={String(tr.fills.length)}      sub="Executions" />
      </div>

      {/* Order ticket */}
      <div className="hf-card">
        <div className="hf-card-head">
          <span className="hf-card-title">New order</span>
          <div className="hf-grow" />
          <span className="hf-card-meta">Paper broker · simulated execution</span>
        </div>
        <div
          style={{
            padding: 14,
            display: "grid",
            gridTemplateColumns: "120px 90px 90px 1fr 1fr 80px 80px auto",
            gap: 10,
            alignItems: "end",
          }}
        >
          <FormField label="Ticker">
            <input
              className="hf-input"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
            />
          </FormField>

          <FormField label="Side">
            <div style={{ display: "flex", gap: 4 }}>
              <button
                className={`hf-btn${side === "BUY" ? " hf-btn-buy" : ""}`}
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setSide("BUY")}
              >
                BUY
              </button>
              <button
                className={`hf-btn${side === "SELL" ? " hf-btn-danger" : ""}`}
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setSide("SELL")}
              >
                SELL
              </button>
            </div>
          </FormField>

          <FormField label="Qty">
            <input className="hf-input" value={qty} onChange={(e) => setQty(e.target.value)} />
          </FormField>

          <FormField label="Type">
            <select className="hf-input" value={orderType} onChange={(e) => setOrderType(e.target.value)}>
              <option value="LMT">LMT — Limit</option>
              <option value="MKT">MKT — Market</option>
              <option value="STP">STP — Stop</option>
              <option value="STP-LMT">STP-LMT — Stop limit</option>
            </select>
          </FormField>

          <FormField label="Limit price">
            <input className="hf-input" value={limitPx} onChange={(e) => setLimitPx(e.target.value)} />
          </FormField>

          <FormField label="TIF">
            <select className="hf-input" value={tif} onChange={(e) => setTif(e.target.value)}>
              <option>DAY</option>
              <option>GTC</option>
              <option>IOC</option>
            </select>
          </FormField>

          <FormField label="Est. value">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, padding: "6px 0", color: "var(--color-text)" }}>
              ${fmt(estValue, 2)}
            </div>
          </FormField>

          <button
            className="hf-btn hf-btn-primary"
            style={{ padding: "8px 18px", alignSelf: "end" }}
          >
            Send
          </button>
        </div>
      </div>

      {/* Open orders + Watchlist */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
        {/* Open orders */}
        <div className="hf-card">
          <div className="hf-card-head">
            <span className="hf-card-title">Open orders</span>
            <div className="hf-grow" />
            <button className="hf-btn hf-btn-ghost hf-btn-danger">Cancel all</button>
          </div>
          <table className="hf-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Side</th>
                <th>Ticker</th>
                <th className="col-r">Qty</th>
                <th>Type</th>
                <th className="col-r">Px</th>
                <th>TIF</th>
                <th className="col-r">Filled</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tr.openOrders.map((o) => (
                <tr key={o.id}>
                  <td className="col-mono" style={{ color: "var(--color-muted)" }}>{o.id}</td>
                  <td><SideBadge side={o.side} /></td>
                  <td><span className="tk-chip">{o.ticker}</span></td>
                  <td className="col-r col-mono">{o.qty}</td>
                  <td className="col-mono">{o.type}</td>
                  <td className="col-r col-mono">{o.px == null ? "MKT" : `$${o.px.toFixed(2)}`}</td>
                  <td className="col-mono">{o.tif}</td>
                  <td className="col-r col-mono">{o.filled}/{o.qty}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td>
                    <button
                      className="hf-btn hf-btn-ghost hf-btn-danger"
                      style={{ padding: "3px 8px", fontSize: 11 }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Watchlist */}
        <div className="hf-card">
          <div className="hf-card-head">
            <span className="hf-card-title">Watchlist</span>
            <div className="hf-grow" />
            <button className="hf-btn hf-btn-ghost">+ Add</button>
          </div>
          <table className="hf-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th className="col-r">Last</th>
                <th className="col-r">Δ Day</th>
                <th className="col-r">Bid</th>
                <th className="col-r">Ask</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {tr.watchlist.map((w) => (
                <tr key={w.ticker}>
                  <td>
                    <span className="tk-chip">{w.ticker}</span>{" "}
                    <span style={{ fontSize: 11, color: "var(--color-muted)" }}>{w.name}</span>
                  </td>
                  <td className="col-r col-mono">${w.px.toFixed(2)}</td>
                  <td className={`col-r col-mono ${w.dayPct >= 0 ? "hf-up" : "hf-down"}`}>
                    {fmtSigned(w.dayPct)}%
                  </td>
                  <td className="col-r col-mono" style={{ color: "var(--color-muted)" }}>{w.bid.toFixed(2)}</td>
                  <td className="col-r col-mono" style={{ color: "var(--color-muted)" }}>{w.ask.toFixed(2)}</td>
                  <td><RegimePill signal={w.signal} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Today's fills */}
      <div className="hf-card">
        <div className="hf-card-head">
          <span className="hf-card-title">Today&apos;s fills</span>
          <div className="hf-grow" />
          <span className="hf-card-meta">{tr.fills.length} executions · all routes</span>
        </div>
        <table className="hf-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Side</th>
              <th>Ticker</th>
              <th className="col-r">Qty</th>
              <th className="col-r">Px</th>
              <th className="col-r">Value</th>
              <th>Route</th>
            </tr>
          </thead>
          <tbody>
            {tr.fills.map((f, i) => (
              <tr key={i}>
                <td className="col-mono" style={{ color: "var(--color-muted)" }}>{f.ts}</td>
                <td><SideBadge side={f.side} /></td>
                <td><span className="tk-chip">{f.ticker}</span></td>
                <td className="col-r col-mono">{f.qty}</td>
                <td className="col-r col-mono">${f.px.toFixed(2)}</td>
                <td className="col-r col-mono">${fmt(f.value, 2)}</td>
                <td className="col-mono" style={{ color: "var(--color-muted)" }}>{f.route}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

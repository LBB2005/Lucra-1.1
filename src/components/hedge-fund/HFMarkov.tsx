"use client";
import type { TickerMarkov, MarkovSection, Regime } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="hf-gauge">
      <span className="hf-gauge-label">{label}</span>
      <span className="hf-gauge-track">
        <span className="hf-gauge-fill" style={{ width: `${value}%`, background: color }} />
      </span>
      <span className="hf-gauge-pct" style={{ color }}>{value.toFixed(1)}%</span>
    </div>
  );
}

function RegimePill({ bias }: { bias: Regime }) {
  return <span className={`hf-regime hf-regime-${bias.toLowerCase()}`}>{bias}</span>;
}

// ── Per-ticker card ───────────────────────────────────────────────────────────

function MarkovCard({ t }: { t: TickerMarkov }) {
  const biasColor =
    t.bias === "Bull"     ? "var(--color-bull)" :
    t.bias === "Bear"     ? "var(--color-bear)" :
                            "var(--color-warn)";

  const rows = (["Bear", "Sideways", "Bull"] as const);

  return (
    <div className="hf-card">
      {/* Header */}
      <div className="hf-card-head">
        <span className="tk-chip">{t.ticker}</span>
        <span className="hf-card-title">{t.label}</span>
        <span className="hf-card-meta">
          {t.rows.toLocaleString()} days · {t.dateRange.start} → {t.dateRange.end}
        </span>
        <div className="hf-grow" />
        <RegimePill bias={t.bias} />
      </div>

      {/* Body: two-column layout */}
      <div className="hf-mkv-grid">
        {/* LEFT — stationary + KPIs */}
        <div>
          <div className="hf-mkv-col-label">Long-run regime mix</div>
          <Gauge label="Bull"     value={t.stationary.Bull}     color="var(--color-bull)" />
          <Gauge label="Sideways" value={t.stationary.Sideways} color="var(--color-warn)" />
          <Gauge label="Bear"     value={t.stationary.Bear}     color="var(--color-bear)" />

          <div className="hf-kpis">
            <div className="hf-kpi">
              <div className="hf-kpi-l">Sharpe (WF)</div>
              <div
                className="hf-kpi-v"
                style={{ color: t.backtest.sharpe > 0.5 ? "var(--color-bull)" : "var(--color-warn)" }}
              >
                {t.backtest.sharpe.toFixed(2)}
              </div>
            </div>
            <div className="hf-kpi">
              <div className="hf-kpi-l">Max DD</div>
              <div className="hf-kpi-v" style={{ color: "var(--color-bear)" }}>
                {t.backtest.maxDrawdown.toFixed(1)}%
              </div>
            </div>
            <div className="hf-kpi">
              <div className="hf-kpi-l">Trades</div>
              <div className="hf-kpi-v">{t.backtest.trades}</div>
            </div>
            <div className="hf-kpi">
              <div className="hf-kpi-l">Bull persist.</div>
              <div className="hf-kpi-v" style={{ color: "var(--color-bull)" }}>
                {t.persistence.Bull.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — transition matrix + HMM */}
        <div>
          <div className="hf-mkv-col-label">Transition matrix · P(next | current)</div>
          <table className="hf-matrix">
            <thead>
              <tr>
                <th>From ↓ / To →</th>
                <th>Bear</th>
                <th>Sideways</th>
                <th>Bull</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row}>
                  <td className="row-head">{row}</td>
                  {rows.map((col) => {
                    const v = t.transitionMatrix[row][col];
                    const intensity = v / 100;
                    const isSelf = row === col;
                    const bg = isSelf
                      ? `color-mix(in oklab, var(--color-bull) ${intensity * 28}%, transparent)`
                      : `color-mix(in oklab, var(--color-bear) ${intensity * 18}%, transparent)`;
                    return (
                      <td
                        key={col}
                        style={{
                          background: bg,
                          fontWeight: isSelf ? 700 : 500,
                          textAlign: "center",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {v.toFixed(1)}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="hf-mkv-col-label" style={{ marginTop: 14 }}>HMM mean daily return</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {(["Bull", "Sideways", "Bear"] as const).map((r) => (
              <div className="hf-kpi" key={r}>
                <div className="hf-kpi-l">{r}</div>
                <div
                  className="hf-kpi-v"
                  style={{ color: t.hmm[r] > 0 ? "var(--color-bull)" : "var(--color-bear)", fontSize: 14 }}
                >
                  {t.hmm[r] > 0 ? "+" : ""}{t.hmm[r].toFixed(3)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Allocation rec footer */}
      <div className="hf-rec">
        <span style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-muted)", fontWeight: 600 }}>
          Regime-weighted allocation
        </span>
        <span className="hf-rec-pct" style={{ color: biasColor }}>
          {t.allocationRec.equityPct}% equity · {t.allocationRec.label}
        </span>
        <span style={{ flex: 1, textAlign: "right", fontSize: 11.5 }}>{t.allocationRec.rationale}</span>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface Props {
  markov: MarkovSection;
  isLoading?: boolean;
  error?: string | null;
}

export function HFMarkov({ markov, isLoading, error }: Props) {
  if (isLoading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--color-muted)", fontSize: 13 }}>
        <div style={{ width: 20, height: 20, border: "2px solid var(--color-accent)", borderTopColor: "transparent", borderRadius: "99px", animation: "spin 0.9s linear infinite", margin: "0 auto 12px" }} />
        Fetching Markov regime data…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--color-bear)", fontSize: 13 }}>
        Error: {error}
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="hf-eyebrow">
          3-state Markov · 20-day rolling labels ·{" "}
          {markov.tickers[0]?.rows.toLocaleString() ?? "—"} trading days
        </div>
        <h2 className="hf-headline">Where the indices sit and where they&apos;re likely to go.</h2>
      </div>

      {markov.tickers.map((t) => (
        <MarkovCard key={t.ticker} t={t} />
      ))}

      {/* Method note */}
      <div
        className="hf-card"
        style={{ background: "var(--color-surface)", padding: "12px 16px", fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.55 }}
      >
        <strong style={{ color: "var(--color-text-secondary)" }}>Method. </strong>
        Regimes are labelled from a 20-day rolling return on 5 years of daily OHLCV. The 3×3 transition
        matrix is the observable empirical estimate. Allocations weight full-equity by Bull probability,
        65% by Sideways, 30% by Bear. Walk-forward Sharpe re-fits at every step — no lookahead. Past
        regimes do not guarantee future ones.
      </div>
    </>
  );
}

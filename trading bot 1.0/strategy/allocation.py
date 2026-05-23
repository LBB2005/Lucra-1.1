"""
Position sizing and allocation based on detected market regime.

Regime → equity fraction deployed:
  BULL     → BULL_EQUITY_PCT     (default 90 %)
  SIDEWAYS → SIDEWAYS_EQUITY_PCT (default 50 %)
  BEAR     → BEAR_EQUITY_PCT     (default  5 %)

Daily drawdown guard: if current equity has fallen ≥ MAX_DAILY_DRAWDOWN_PCT
from start-of-day equity, all target positions are set to 0.
main.py is responsible for actually closing the open positions.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

from config import (
    BEAR_EQUITY_PCT,
    BULL_EQUITY_PCT,
    FRACTIONAL_SHARES,
    MAX_DAILY_DRAWDOWN_PCT,
    SIDEWAYS_EQUITY_PCT,
)
from engine.regime_detector import Regime

_REGIME_PCT: dict[Regime, float] = {
    Regime.BULL:     BULL_EQUITY_PCT,
    Regime.SIDEWAYS: SIDEWAYS_EQUITY_PCT,
    Regime.BEAR:     BEAR_EQUITY_PCT,
}


@dataclass
class AllocationPlan:
    regime:          Regime
    equity_pct:      float           # fraction of account to deploy
    drawdown_halted: bool            # True → daily-DD limit triggered, all flat
    positions:       Dict[str, float]  # ticker → target shares (fractional OK)


def compute_allocation(
    regime: Regime,
    tickers: list[str],
    current_equity: float,
    start_of_day_equity: float,
    latest_prices: Dict[str, float],
) -> AllocationPlan:
    """
    Returns target share quantities for every ticker.

    current_equity:       live portfolio value
    start_of_day_equity:  equity captured at today's open (for DD calc)
    latest_prices:        {ticker: last price}
    """
    drawdown_pct = (
        (start_of_day_equity - current_equity) / start_of_day_equity * 100
        if start_of_day_equity > 0 else 0.0
    )

    if drawdown_pct >= MAX_DAILY_DRAWDOWN_PCT:
        return AllocationPlan(
            regime=regime,
            equity_pct=0.0,
            drawdown_halted=True,
            positions={t: 0.0 for t in tickers},
        )

    equity_pct  = _REGIME_PCT[regime]
    deploy_cash = current_equity * equity_pct
    per_ticker  = deploy_cash / len(tickers) if tickers else 0.0

    positions: Dict[str, float] = {}
    for ticker in tickers:
        price = latest_prices.get(ticker, 0.0)
        if price <= 0:
            positions[ticker] = 0.0
        elif FRACTIONAL_SHARES:
            positions[ticker] = round(per_ticker / price, 4)
        else:
            positions[ticker] = float(int(per_ticker // price))

    return AllocationPlan(
        regime=regime,
        equity_pct=equity_pct,
        drawdown_halted=False,
        positions=positions,
    )

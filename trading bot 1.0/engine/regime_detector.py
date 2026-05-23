"""
Market regime detector.

Primary method: dual-SMA crossover (50/200) gated by ATR volatility.
  - SMA50 > SMA200 + ATR normal → BULL
  - SMA50 < SMA200  OR  ATR spike → BEAR
  - Otherwise → SIDEWAYS

PlaceholderHMM is a zero-dependency stub you can swap out for a real
hmmlearn GaussianHMM without touching the strategy or main layers.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

import numpy as np
import pandas as pd

from config import SHORT_MA_WINDOW, LONG_MA_WINDOW, ATR_WINDOW, ATR_BEAR_THRESH


class Regime(str, Enum):
    BULL     = "BULL"
    BEAR     = "BEAR"
    SIDEWAYS = "SIDEWAYS"


@dataclass
class RegimeResult:
    regime:           Regime
    short_ma:         float
    long_ma:          float
    atr:              float
    atr_median:       float
    confidence:       float   # 0–1 heuristic (SMA-based)
    bull_persistence: float   # Markov P(Bull→Bull), 0–1


def compute_bull_persistence(bars: pd.DataFrame, window: int = 20) -> float:
    """
    Estimates Bull→Bull persistence from a Markov regime model.

    Labels each day as Bull / Sideways / Bear using a rolling `window`-day
    return (tercile split), then counts how often a Bull day is followed by
    another Bull day.  Returns the empirical probability P(Bull→Bull).

    Falls back to 0.5 if there is insufficient data.
    """
    if len(bars) < window + 10:
        return 0.5

    rolling_ret = bars["close"].pct_change(window).dropna()
    lower = rolling_ret.quantile(1 / 3)
    upper = rolling_ret.quantile(2 / 3)

    def _label(r: float) -> str:
        if r >= upper:
            return "Bull"
        if r <= lower:
            return "Bear"
        return "Sideways"

    labels = rolling_ret.map(_label).tolist()

    bull_stay  = sum(
        1 for i in range(len(labels) - 1)
        if labels[i] == "Bull" and labels[i + 1] == "Bull"
    )
    bull_total = sum(1 for i in range(len(labels) - 1) if labels[i] == "Bull")

    return round(bull_stay / bull_total, 4) if bull_total > 0 else 0.5


def _atr(df: pd.DataFrame, window: int) -> pd.Series:
    high, low, prev_close = df["high"], df["low"], df["close"].shift(1)
    tr = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr.rolling(window).mean()


def detect_regime(bars: pd.DataFrame) -> RegimeResult:
    """
    bars: OHLCV DataFrame with DatetimeIndex.
    Requires ≥ LONG_MA_WINDOW rows.
    """
    if len(bars) < LONG_MA_WINDOW:
        raise ValueError(f"Need ≥ {LONG_MA_WINDOW} bars; got {len(bars)}")

    close      = bars["close"]
    short_ma   = float(close.rolling(SHORT_MA_WINDOW).mean().iloc[-1])
    long_ma    = float(close.rolling(LONG_MA_WINDOW).mean().iloc[-1])
    atr_series = _atr(bars, ATR_WINDOW)
    atr        = float(atr_series.iloc[-1])
    atr_median = float(atr_series.median())

    high_vol = atr > ATR_BEAR_THRESH * atr_median

    if short_ma > long_ma and not high_vol:
        regime     = Regime.BULL
        confidence = min((short_ma - long_ma) / long_ma * 100, 1.0)
    elif short_ma < long_ma or high_vol:
        regime     = Regime.BEAR
        confidence = (
            min((long_ma - short_ma) / long_ma * 100, 1.0)
            if short_ma < long_ma else 0.6
        )
    else:
        regime     = Regime.SIDEWAYS
        confidence = 0.5

    bull_persistence = compute_bull_persistence(bars)

    return RegimeResult(
        regime=regime,
        short_ma=round(short_ma, 4),
        long_ma=round(long_ma, 4),
        atr=round(atr, 4),
        atr_median=round(atr_median, 4),
        confidence=round(confidence, 4),
        bull_persistence=bull_persistence,
    )


class PlaceholderHMM:
    """
    Drop-in stub; replace with hmmlearn.hmm.GaussianHMM when ready.
    Exposes the same fit() / predict() interface so strategy code stays unchanged.
    """

    def fit(self, returns: np.ndarray) -> "PlaceholderHMM":
        return self

    def predict(self, returns: np.ndarray) -> Regime:
        if len(returns) == 0:
            return Regime.SIDEWAYS
        mean_ret = float(np.mean(returns[-20:]))
        if mean_ret > 0.0005:
            return Regime.BULL
        if mean_ret < -0.0005:
            return Regime.BEAR
        return Regime.SIDEWAYS

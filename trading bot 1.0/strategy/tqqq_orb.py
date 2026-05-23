"""
TQQQ Opening Range Breakout Strategy
=====================================

Timing (all ET):
  9:30 AM — market opens, observation window begins
  9:45 AM — ORB captured (high/low of 9:30–9:44 QQQ 1-min bars)
  9:45+   — scan every tick for a clean breakout
  3:55 PM — force-flatten anything still open

Regime gate (SPY SMA50/200 + ATR):
  BULL     → long-only  → buy TQQQ on upside break
  BEAR     → short-only → buy SQQQ on downside break
  SIDEWAYS → no trade today

Position management:
  Trailing stop: 2% from high-water mark  (rides the wave, no fixed TP cap)
  Hard floor:    −3% from entry price     (checked each tick in main.py)
  Size:          40% of account equity per trade (one trade max per day)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import pandas as pd
import pytz

from config import (
    ORB_FLATTEN_TIME,
    ORB_INSTRUMENT_LONG,
    ORB_INSTRUMENT_SHORT,
    ORB_POSITION_PCT,
    ORB_SIGNAL_TICKER,
    ORB_STOP_LOSS_PCT,
    ORB_TRAIL_PCT,
)
from engine.regime_detector import Regime

log = logging.getLogger(__name__)
ET  = pytz.timezone("America/New_York")


@dataclass
class OrbState:
    trade_date:       Optional[date]  = None
    orb_high:         Optional[float] = None
    orb_low:          Optional[float] = None
    orb_locked:       bool            = False
    position_entered: bool            = False
    skipped:          bool            = False   # True when regime is SIDEWAYS or persistence too low
    entry_side:       Optional[str]   = None    # "LONG" | "SHORT"
    instrument:       Optional[str]   = None    # "TQQQ" | "SQQQ"
    entry_price:      Optional[float] = None
    hard_stop_price:  Optional[float] = None    # -3% from entry, checked each tick
    qty:              Optional[float] = None
    order_id:         Optional[str]   = None
    position_scale:   Optional[float] = None    # persistence multiplier 0–1
    actual_pct:       Optional[float] = None    # ORB_POSITION_PCT × position_scale


class TQQQOrbStrategy:
    """
    Stateful ORB strategy. Instantiate once; call the methods in order each day:
      1. reset_for_new_day()    — at SOD
      2. capture_orb(bars)      — at 9:45 ET with the 9:30–9:44 1-min bars
      3. check_entry(regime, equity)  — every tick after capture
      (Alpaca bracket orders handle stop/target automatically.)
      4. flatten() is called by main.py at 3:55 ET
    """

    def __init__(self, client) -> None:
        self._client = client
        self._state  = OrbState()

    @property
    def state(self) -> OrbState:
        return self._state

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def reset_for_new_day(self) -> None:
        self._state = OrbState(trade_date=datetime.now(tz=ET).date())
        log.info("[ORB] Day reset — %s", self._state.trade_date)

    # ── Step 1: lock the range ─────────────────────────────────────────────────

    def capture_orb(self, bars: pd.DataFrame) -> None:
        """
        Called at 9:45 ET. bars = 1-min OHLCV for QQQ covering 9:30–9:44.
        """
        if self._state.orb_locked:
            return

        if bars.empty:
            log.warning("[ORB] Empty bars at capture — ORB not locked, skipping today.")
            self._state.skipped = True
            return

        self._state.orb_high   = float(bars["high"].max())
        self._state.orb_low    = float(bars["low"].min())
        self._state.orb_locked = True

        range_pct = (self._state.orb_high - self._state.orb_low) / self._state.orb_low * 100
        log.info(
            "[ORB] Range locked — %s High=%.2f  Low=%.2f  (%.2f%% wide)",
            ORB_SIGNAL_TICKER, self._state.orb_high, self._state.orb_low, range_pct,
        )

    # ── Step 2: scan for breakout every tick ──────────────────────────────────

    def check_entry(
        self,
        regime: Regime,
        current_equity: float,
        position_scale: float = 1.0,
    ) -> Optional[str]:
        """
        Returns a log-worthy string if a trade was placed, else None.
        Should be called every tick after capture_orb().

        position_scale: 0–1 multiplier derived from Bull persistence.
          1.0 = full ORB_POSITION_PCT, 0.0 = skip trade.
        """
        s = self._state

        if not s.orb_locked or s.position_entered or s.skipped:
            return None

        # Persistence too low → skip
        if position_scale <= 0.0:
            s.skipped = True
            log.info("[ORB] Persistence below floor — sitting out today.")
            return "Persistence below floor — regime too unstable, no trade today"

        # Sideways → no trade
        if regime == Regime.SIDEWAYS:
            s.skipped = True
            log.info("[ORB] Regime SIDEWAYS — sitting out today.")
            return "SIDEWAYS regime — no trade today"

        # Fetch current QQQ price for breakout check
        try:
            signal_price = self._client.get_latest_price(ORB_SIGNAL_TICKER)
        except Exception as exc:
            log.error("[ORB] %s price fetch failed: %s", ORB_SIGNAL_TICKER, exc)
            return None

        bull_break = signal_price > s.orb_high and regime == Regime.BULL
        bear_break = signal_price < s.orb_low  and regime == Regime.BEAR

        if not bull_break and not bear_break:
            return None

        instrument = ORB_INSTRUMENT_LONG if bull_break else ORB_INSTRUMENT_SHORT
        label      = "LONG"             if bull_break else "SHORT"

        # Fetch instrument price and size the trade
        try:
            inst_price = self._client.get_latest_price(instrument)
        except Exception as exc:
            log.error("[ORB] %s price fetch failed: %s", instrument, exc)
            return None

        actual_pct      = ORB_POSITION_PCT * min(position_scale, 1.0)
        deploy          = current_equity * actual_pct
        qty             = round(deploy / inst_price, 4)
        hard_stop_price = round(inst_price * (1 - ORB_STOP_LOSS_PCT), 2)

        order_id = self._client.place_market_with_trailing_stop(
            symbol=instrument,
            qty=qty,
            side="buy",
            trail_pct=ORB_TRAIL_PCT,
        )

        if not order_id:
            return None

        s.position_entered = True
        s.entry_side       = label
        s.instrument       = instrument
        s.entry_price      = inst_price
        s.hard_stop_price  = hard_stop_price
        s.qty              = qty
        s.order_id         = order_id
        s.position_scale   = round(position_scale, 4)
        s.actual_pct       = round(actual_pct, 4)

        msg = (
            f"ORB {label} — BUY {instrument} x{qty:.2f} @ ${inst_price:.2f}  "
            f"TRAIL={ORB_TRAIL_PCT:.0f}%  "
            f"FLOOR=${hard_stop_price:.2f} (-{ORB_STOP_LOSS_PCT*100:.0f}%)  "
            f"size={actual_pct*100:.0f}% (scale={position_scale:.0%})  "
            f"regime={regime.value}"
        )
        log.info("[ORB] %s", msg)
        return msg

    # ── Hard floor check (called each tick in main.py) ────────────────────────

    def should_hard_stop(self, current_price: float) -> bool:
        """
        Returns True if current_price has breached the hard floor stop
        (-3% from entry).  Only meaningful once position_entered is True.
        """
        s = self._state
        if not s.position_entered or s.hard_stop_price is None:
            return False
        return current_price <= s.hard_stop_price

    # ── Status dict for status.json ────────────────────────────────────────────

    def status_dict(self) -> dict:
        s = self._state
        return {
            "orb_high":         s.orb_high,
            "orb_low":          s.orb_low,
            "orb_locked":       s.orb_locked,
            "position_entered": s.position_entered,
            "entry_side":       s.entry_side,
            "instrument":       s.instrument,
            "entry_price":      s.entry_price,
            "hard_stop_price":  s.hard_stop_price,
            "trail_pct":        ORB_TRAIL_PCT,
            "qty":              s.qty,
            "skipped":          s.skipped,
            "position_scale":   s.position_scale,
            "actual_pct":       s.actual_pct,
        }

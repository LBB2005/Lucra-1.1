"""
Alpaca broker client — paper trading wrapper around alpaca-trade-api.

All secrets are read from config (which loads .env).
Never hardcode credentials in this file.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import pandas as pd
import alpaca_trade_api as tradeapi
from alpaca_trade_api.rest import APIError

from config import ALPACA_API_KEY, ALPACA_API_SECRET, ALPACA_BASE_URL

log = logging.getLogger(__name__)


class AlpacaClient:
    def __init__(self) -> None:
        if not ALPACA_API_KEY or not ALPACA_API_SECRET:
            raise RuntimeError("Alpaca credentials missing — check your .env file.")
        self._api = tradeapi.REST(
            key_id=ALPACA_API_KEY,
            secret_key=ALPACA_API_SECRET,
            base_url=ALPACA_BASE_URL,
        )

    # ── Account ───────────────────────────────────────────────────────────────

    def get_equity(self) -> float:
        return float(self._api.get_account().equity)

    def get_buying_power(self) -> float:
        return float(self._api.get_account().buying_power)

    def get_account_summary(self) -> dict:
        acct = self._api.get_account()
        return {
            "equity":          float(acct.equity),
            "buying_power":    float(acct.buying_power),
            "cash":            float(acct.cash),
            "portfolio_value": float(acct.portfolio_value),
            "day_trade_count": int(acct.daytrade_count),
            "account_blocked": acct.account_blocked,
            "trading_blocked": acct.trading_blocked,
        }

    # ── Market data ───────────────────────────────────────────────────────────

    def get_intraday_bars(
        self,
        ticker: str,
        start: str,
        end: str,
        timeframe: str = "1Min",
    ) -> pd.DataFrame:
        """
        Returns 1-minute OHLCV bars between start and end (ISO-8601 strings with TZ).
        Example: start="2024-01-15T09:30:00-05:00", end="2024-01-15T09:45:00-05:00"
        """
        bars = self._api.get_bars(
            ticker,
            timeframe,
            start=start,
            end=end,
            adjustment="raw",
        ).df

        if bars.empty:
            return bars

        bars.index   = pd.to_datetime(bars.index, utc=True)
        bars.columns = [c.lower() for c in bars.columns]
        return bars[["open", "high", "low", "close", "volume"]].dropna().sort_index()

    def place_bracket_order(
        self,
        symbol: str,
        qty: float,
        side: str,                # "buy" | "sell"
        take_profit_price: float,
        stop_loss_price: float,
    ) -> Optional[str]:
        """
        Submits a market bracket order (entry + take-profit limit + stop-loss stop).
        Returns the parent order id or None on failure.
        """
        if qty <= 0:
            return None
        qty_param = qty if qty != int(qty) else int(qty)
        try:
            order = self._api.submit_order(
                symbol=symbol,
                qty=qty_param,
                side=side,
                type="market",
                time_in_force="day",
                order_class="bracket",
                take_profit={"limit_price": str(round(take_profit_price, 2))},
                stop_loss={"stop_price": str(round(stop_loss_price, 2))},
            )
            log.info(
                "BRACKET %s %s x%s  TP=$%.2f  SL=$%.2f  id=%s",
                side.upper(), symbol, qty_param,
                take_profit_price, stop_loss_price, order.id,
            )
            return order.id
        except APIError as e:
            log.error("Bracket order failed %s %s x%s: %s", side.upper(), symbol, qty_param, e)
            return None

    def place_market_with_trailing_stop(
        self,
        symbol: str,
        qty: float,
        side: str,          # "buy" | "sell"
        trail_pct: float,   # e.g. 2.0 means trail 2% from peak
    ) -> Optional[str]:
        """
        Places a market entry then immediately a trailing-stop exit.
        The trail follows the high-water mark; exits when price pulls back
        trail_pct% from its peak.  A separate hard floor stop is checked
        each tick in main.py.

        Returns the entry order id, or None on any failure.
        If entry succeeds but the trailing-stop order fails, the position
        is closed immediately to avoid unprotected exposure.
        """
        if qty <= 0:
            return None
        qty_param  = qty if qty != int(qty) else int(qty)
        exit_side  = "sell" if side == "buy" else "buy"

        try:
            # ── 1. Market entry ───────────────────────────────────────────
            entry = self._api.submit_order(
                symbol=symbol,
                qty=qty_param,
                side=side,
                type="market",
                time_in_force="day",
            )
            log.info("ENTRY  %s %s x%s  id=%s", side.upper(), symbol, qty_param, entry.id)

            # ── 2. Trailing-stop exit ────────────────────────────────────
            try:
                trail = self._api.submit_order(
                    symbol=symbol,
                    qty=qty_param,
                    side=exit_side,
                    type="trailing_stop",
                    time_in_force="day",
                    trail_percent=str(round(trail_pct, 2)),
                )
                log.info(
                    "TRAIL  %s %s x%s  trail=%.1f%%  id=%s",
                    exit_side.upper(), symbol, qty_param, trail_pct, trail.id,
                )
            except APIError as trail_err:
                # Entry is live but trail failed — close immediately rather
                # than leave an unprotected position open.
                log.error(
                    "Trailing-stop order failed for %s — closing position. err=%s",
                    symbol, trail_err,
                )
                try:
                    self._api.close_position(symbol)
                except Exception:
                    pass
                return None

            return entry.id

        except APIError as e:
            log.error(
                "Market+trail order failed %s %s x%s: %s",
                side.upper(), symbol, qty_param, e,
            )
            return None

    def get_bars(
        self,
        ticker: str,
        days: int = 300,
        timeframe: str = "1Day",
    ) -> pd.DataFrame:
        """
        Returns OHLCV DataFrame (lowercase columns), sorted ascending by date.
        Fetches an extra 50-day buffer so MA warmup windows are always satisfied.
        """
        end   = datetime.utcnow().date()
        start = end - timedelta(days=days + 50)

        bars = self._api.get_bars(
            ticker,
            timeframe,
            start=start.isoformat(),
            end=end.isoformat(),
            adjustment="raw",
        ).df

        if bars.empty:
            raise ValueError(f"No bar data returned for {ticker}")

        bars.index = pd.to_datetime(bars.index, utc=True)
        bars.columns = [c.lower() for c in bars.columns]
        return bars[["open", "high", "low", "close", "volume"]].dropna().sort_index()

    def get_latest_price(self, ticker: str) -> float:
        return float(self._api.get_latest_trade(ticker).price)

    def get_latest_prices(self, tickers: List[str]) -> Dict[str, float]:
        trades = self._api.get_latest_trades(tickers)
        return {t: float(trades[t].price) for t in tickers if t in trades}

    # ── Positions ─────────────────────────────────────────────────────────────

    def get_positions(self) -> Dict[str, float]:
        """Returns {ticker: qty} for all open positions (fractional)."""
        return {p.symbol: float(p.qty) for p in self._api.list_positions()}

    def close_all_positions(self) -> None:
        log.warning("Closing ALL positions.")
        try:
            self._api.close_all_positions()
        except APIError as e:
            log.error("close_all_positions failed: %s", e)

    # ── Orders ────────────────────────────────────────────────────────────────

    def place_market_order(
        self,
        ticker: str,
        qty: float,
        side: str,               # "buy" | "sell"
        time_in_force: str = "day",
    ) -> Optional[str]:
        """Submits a market order (fractional qty supported). Returns order id or None on failure."""
        if qty <= 0:
            return None
        qty_param = qty if qty != int(qty) else int(qty)
        try:
            order = self._api.submit_order(
                symbol=ticker,
                qty=qty_param,
                side=side,
                type="market",
                time_in_force=time_in_force,
            )
            log.info("ORDER  %s %s x%s  id=%s", side.upper(), ticker, qty_param, order.id)
            return order.id
        except APIError as e:
            log.error("Order failed %s %s x%s: %s", side.upper(), ticker, qty_param, e)
            return None

    def reconcile_position(
        self,
        ticker: str,
        target_qty: float,
        current_qty: float,
    ) -> Optional[str]:
        """
        Adjusts an open position to target_qty via a single market order.
        Returns the order id, or None if already at target.
        """
        delta = round(target_qty - current_qty, 4)
        if abs(delta) < 0.0001:
            return None
        side = "buy" if delta > 0 else "sell"
        return self.place_market_order(ticker, abs(delta), side)

    def cancel_all_orders(self) -> None:
        try:
            self._api.cancel_all_orders()
            log.info("All open orders cancelled.")
        except APIError as e:
            log.error("cancel_all_orders failed: %s", e)

    # ── Market hours ──────────────────────────────────────────────────────────

    def is_market_open(self) -> bool:
        return bool(self._api.get_clock().is_open)

    def next_market_open(self) -> datetime:
        return self._api.get_clock().next_open.replace(tzinfo=None)

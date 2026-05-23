"""
Central configuration.  All secrets come from .env — never hardcode here.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── Alpaca credentials ─────────────────────────────────────────────────────────
ALPACA_API_KEY    = os.getenv("ALPACA_API_KEY", "")
ALPACA_API_SECRET = os.getenv("ALPACA_API_SECRET", "")
ALPACA_BASE_URL   = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")

# ── Strategy mode ─────────────────────────────────────────────────────────────
# "orb"        → TQQQ Opening Range Breakout (primary)
# "allocation" → legacy SPY/QQQ/DIA regime allocation
STRATEGY_MODE = "orb"

# ── Trading universe (allocation mode only) ────────────────────────────────────
TICKERS: list[str] = ["SPY", "QQQ", "DIA"]

# ── Risk parameters (shared) ───────────────────────────────────────────────────
MAX_DAILY_DRAWDOWN_PCT = 3.0   # close all if equity drops this % from SOD
BULL_EQUITY_PCT        = 0.90  # 90 % invested in Bull regime
SIDEWAYS_EQUITY_PCT    = 0.50  # 50 % invested in Sideways
BEAR_EQUITY_PCT        = 0.05  # 5 %  invested in Bear (near-flat)
FRACTIONAL_SHARES      = True  # Alpaca paper supports fractional quantities

# ── Regime detector (shared) ───────────────────────────────────────────────────
SHORT_MA_WINDOW  = 50    # days for short SMA
LONG_MA_WINDOW   = 200   # days for long SMA
ATR_WINDOW       = 14    # days for ATR
ATR_BEAR_THRESH  = 2.0   # multiplier over median ATR → flag high-vol Bear

# ── TQQQ Opening Range Breakout ────────────────────────────────────────────────
ORB_REGIME_TICKER     = "SPY"   # use SPY SMA/ATR for the macro regime gate
ORB_SIGNAL_TICKER     = "QQQ"   # build the range from QQQ 1-min bars
ORB_INSTRUMENT_LONG   = "TQQQ"  # buy this on Bull breakouts  (3× long QQQ)
ORB_INSTRUMENT_SHORT  = "SQQQ"  # buy this on Bear breakouts  (3× short QQQ)
ORB_WINDOW_MINUTES    = 15      # observe 9:30–9:44 ET to build range
ORB_CAPTURE_TIME      = "09:45" # ET — lock range and begin scanning for break
ORB_FLATTEN_TIME      = "15:55" # ET — force-close all ORB positions
ORB_POSITION_PCT      = 0.40    # 40 % of account equity per trade
ORB_TRAIL_PCT         = 2.0     # 2 % trailing stop from high-water mark
ORB_STOP_LOSS_PCT     = 0.03    # 3 % hard floor stop-loss from entry price

# ── Persistence-weighted sizing ────────────────────────────────────────────────
# Bull→Bull Markov persistence gates position size.
#   persistence >= ORB_PERSISTENCE_FULL  → full ORB_POSITION_PCT (100 % scale)
#   ORB_PERSISTENCE_FLOOR <= p < FULL    → linear interpolation down to 0 %
#   persistence <  ORB_PERSISTENCE_FLOOR → skip trade entirely
ORB_PERSISTENCE_FLOOR = 0.75   # below this → no trade today
ORB_PERSISTENCE_FULL  = 0.90   # at or above this → full position size

# ── Scheduler ─────────────────────────────────────────────────────────────────
MARKET_OPEN_ET   = "09:35"  # 5-min cushion after open (SOD lock)
MARKET_CLOSE_ET  = "15:50"  # legacy allocation flatten (unused in ORB mode)
LOOP_INTERVAL_S  = 30       # seconds between main-loop ticks (tighter for ORB)

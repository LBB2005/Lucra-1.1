// ── Hedge Fund sub-app shared types ──────────────────────────────────────────

export type HFTab = "overview" | "strategies" | "trading" | "bot";

// Markov -----------------------------------------------------------------------
export type Regime = "Bull" | "Sideways" | "Bear";

export interface TransitionMatrix {
  Bear:     { Bear: number; Sideways: number; Bull: number };
  Sideways: { Bear: number; Sideways: number; Bull: number };
  Bull:     { Bear: number; Sideways: number; Bull: number };
}

export interface TickerMarkov {
  ticker: string;
  label: string;
  bias: Regime;
  rows: number;
  dateRange: { start: string; end: string };
  stationary: { Bull: number; Sideways: number; Bear: number };
  persistence: { Bull: number; Sideways: number; Bear: number };
  transitionMatrix: TransitionMatrix;
  hmm: { Bull: number; Sideways: number; Bear: number };
  backtest: { sharpe: number; maxDrawdown: number; trades: number };
  allocationRec: { equityPct: number; label: string; rationale: string };
}

export interface CompositeMarkov {
  bias: Regime;
  avgBull: number;
  avgSideways: number;
  avgBear: number;
  avgSharpe: number;
  equityPct: number;
}

export interface MarkovSection {
  generatedAt: string;
  composite: CompositeMarkov;
  tickers: TickerMarkov[];
}

// Trading ----------------------------------------------------------------------
export type OrderSide   = "BUY" | "SELL";
export type OrderStatus = "Working" | "Partial" | "Queued" | "Filled";

export interface Order {
  id: string;
  side: OrderSide;
  ticker: string;
  qty: number;
  type: string;
  px: number | null;
  tif: string;
  filled: number;
  status: OrderStatus;
}

export interface Fill {
  ts: string;
  side: OrderSide;
  ticker: string;
  qty: number;
  px: number;
  value: number;
  route: string;
}

export interface WatchItem {
  ticker: string;
  name: string;
  px: number;
  dayPct: number;
  bid: number;
  ask: number;
  signal: Regime;
}

export interface TradingSection {
  buyingPower: number;
  dayPnL: number;
  dayPnLPct: number;
  openOrders: Order[];
  fills: Fill[];
  watchlist: WatchItem[];
}

// Strategies -------------------------------------------------------------------
export type StrategyTag = "Live" | "Paper" | "Draft";

// Bot execution parameters stored as JSON in the DB
export interface StrategyConfig {
  mode?:                   string;   // "orb" | "allocation" | "custom"
  regime_ticker?:          string;
  signal_ticker?:          string;
  instrument_long?:        string;
  instrument_short?:       string;
  orb_window_minutes?:     number;
  capture_time_et?:        string;
  flatten_time_et?:        string;
  position_pct?:           number;
  profit_target_pct?:      number;
  stop_loss_pct?:          number;
  max_daily_drawdown_pct?: number;
  [key: string]: unknown;            // allow custom fields
}

export interface Strategy {
  id: string;
  name: string;
  tag: StrategyTag;
  desc: string;
  tickers: string[];
  config: StrategyConfig;
  research: string;                  // markdown
  sharpe: number;
  cagr: number;
  maxDD: number;
  winRate: number;
  active: boolean;
  lastTrade: string;
}

// Bot --------------------------------------------------------------------------
export interface BotLogEntry {
  ts: string;
  lvl: "ORDER" | "SIGNAL" | "RISK" | "INFO";
  msg: string;
}

export interface BotSection {
  status: "Running" | "Paused" | "Stopped";
  uptime: string;
  strategiesActive: number;
  cashAllocated: number;
  cashFree: number;
  todayTrades: number;
  todayPnL: number;
  schedule: string;
  lastHeartbeat: string;
  log: BotLogEntry[];
}

// Root -------------------------------------------------------------------------
export interface HFData {
  markov: MarkovSection;
  trading: TradingSection;
  strategies: Strategy[];
  bot: BotSection;
}

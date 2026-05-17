import type Anthropic from "@anthropic-ai/sdk";

export const agentTools: Anthropic.Tool[] = [
  {
    name: "run_risk_agent",
    description:
      "Analyzes portfolio concentration, sector exposure, volatility, beta, and overall risk profile. Use when the user asks about risk, diversification, or portfolio health.",
    input_schema: {
      type: "object" as const,
      properties: {
        tickers: { type: "array", items: { type: "string" }, description: "Portfolio ticker symbols" },
        focus: { type: "string", description: "Optional specific risk aspect to focus on" },
      },
      required: ["tickers"],
    },
  },
  {
    name: "run_news_agent",
    description:
      "Fetches and summarizes recent news for specified tickers. Use for news, sentiment, or recent events.",
    input_schema: {
      type: "object" as const,
      properties: {
        tickers: { type: "array", items: { type: "string" } },
        days: { type: "number", description: "Days of news to fetch (default 7)" },
      },
      required: ["tickers"],
    },
  },
  {
    name: "run_macro_agent",
    description:
      "Analyzes macro indicators, sector ETF performance, and broad market trends. Use for big-picture market context or when the user asks about the overall market.",
    input_schema: {
      type: "object" as const,
      properties: {
        sectors: { type: "array", items: { type: "string" }, description: "Relevant sectors from the portfolio" },
      },
      required: [],
    },
  },
  {
    name: "run_technical_agent",
    description:
      "Calculates RSI, MACD, and moving averages for tickers using price history. Use for technical analysis questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        tickers: { type: "array", items: { type: "string" } },
        indicators: {
          type: "array",
          items: { type: "string", enum: ["rsi", "macd", "sma20", "sma50", "sma200"] },
          description: "Which indicators to calculate",
        },
      },
      required: ["tickers"],
    },
  },
  {
    name: "run_dcf_agent",
    description:
      "Runs a discounted cash flow valuation using financials from Polygon and EDGAR. Use for fundamental valuation, fair value, or intrinsic value questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        ticker: { type: "string" },
        wacc: { type: "number", description: "Discount rate (default 0.10)" },
        growthRate: { type: "number", description: "Terminal growth rate (default 0.025)" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "run_earnings_agent",
    description:
      "Fetches upcoming earnings dates, EPS estimates, historical EPS surprises, and guidance. Use when the user asks about earnings catalysts.",
    input_schema: {
      type: "object" as const,
      properties: {
        tickers: { type: "array", items: { type: "string" } },
      },
      required: ["tickers"],
    },
  },
  {
    name: "run_insider_agent",
    description:
      "Pulls SEC Form 4 insider trades and 13F institutional ownership changes from EDGAR. Use for insider buying/selling or institutional positioning questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        tickers: { type: "array", items: { type: "string" } },
      },
      required: ["tickers"],
    },
  },
  {
    name: "run_sentiment_agent",
    description:
      "Aggregates social sentiment from StockTwits and Reddit for specified tickers. Use for sentiment analysis or retail investor interest questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        tickers: { type: "array", items: { type: "string" } },
      },
      required: ["tickers"],
    },
  },
  {
    name: "run_competitor_agent",
    description:
      "Compares a stock to its sector peers on key multiples (P/E, EV/EBITDA, margins, revenue growth). Use for relative valuation or competitive positioning questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        ticker: { type: "string", description: "Primary ticker to analyze" },
        peers: { type: "array", items: { type: "string" }, description: "Peer tickers (optional — agent will identify peers if omitted)" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "run_options_agent",
    description:
      "Analyzes unusual options activity, put/call ratios, and open interest for specified tickers using Polygon options data.",
    input_schema: {
      type: "object" as const,
      properties: {
        tickers: { type: "array", items: { type: "string" } },
      },
      required: ["tickers"],
    },
  },
  {
    name: "run_comparables_agent",
    description:
      "Benchmarks a stock's P/E, EV/EBITDA, P/S, P/B, and FCF Yield against same-sector peers. Use for relative valuation questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        ticker: { type: "string", description: "Primary ticker to benchmark" },
        peers: { type: "array", items: { type: "string" }, description: "Peer tickers (optional — agent will identify peers if omitted)" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "run_graham_agent",
    description:
      "Runs a full Benjamin Graham defensive value screen: Graham Number, margin of safety, P/E, P/B, debt, and current ratio checks with an overall pass/fail verdict. Use for value investing or 'is this stock cheap?' questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        ticker: { type: "string", description: "Ticker to screen" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "run_analyst_agent",
    description:
      "Aggregates Wall Street analyst price targets and buy/hold/sell consensus ratings from Finnhub and Polygon. Use when the user asks about analyst opinions, price targets, or Wall Street sentiment.",
    input_schema: {
      type: "object" as const,
      properties: {
        tickers: { type: "array", items: { type: "string" }, description: "Tickers to look up" },
      },
      required: ["tickers"],
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...({ cache_control: { type: "ephemeral" } } as any),
  },
];

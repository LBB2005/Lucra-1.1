/**
 * Agent Memory System
 *
 * Three capabilities:
 * 1. Result cache — each agent's output is cached in SQLite with agent-specific TTLs.
 *    Repeat queries return instantly without hitting any external APIs.
 * 2. Ticker memory — after each CEO response, Claude Haiku distills 3-5 key insights
 *    per ticker and stores them. Future runs inject these as "Previous Analysis Memory"
 *    into the CEO system prompt.
 * 3. Ticker extraction — parses free text to find mentioned stock tickers.
 */

import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

// ── TTL configuration (milliseconds) ─────────────────────────────────────────

const AGENT_TTL_MS: Record<string, number> = {
  run_technical_agent:    2  * 60 * 60 * 1000,
  run_options_agent:      2  * 60 * 60 * 1000,
  run_news_agent:         4  * 60 * 60 * 1000,
  run_macro_agent:        4  * 60 * 60 * 1000,
  run_sentiment_agent:    5  * 60 * 60 * 1000,
  run_hype_agent:         5  * 60 * 60 * 1000,
  run_insider_agent:      6  * 60 * 60 * 1000,
  run_risk_agent:         12 * 60 * 60 * 1000,
  run_earnings_agent:     12 * 60 * 60 * 1000,
  run_analyst_agent:      24 * 60 * 60 * 1000,
  run_dcf_agent:          48 * 60 * 60 * 1000,
  run_fundamentals_agent: 48 * 60 * 60 * 1000,
  run_comparables_agent:  48 * 60 * 60 * 1000,
  run_graham_agent:       48 * 60 * 60 * 1000,
  run_competitor_agent:   48 * 60 * 60 * 1000,
};

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6h fallback

const MAX_INSIGHTS_PER_TICKER = 15;

// ── Cache key construction ────────────────────────────────────────────────────

/**
 * Normalize input so cache keys are stable regardless of object property order
 * or array element order (e.g. ["AAPL","MSFT"] === ["MSFT","AAPL"]).
 */
function normalizeInput(input: unknown): unknown {
  if (Array.isArray(input)) {
    return [...input].sort().map(normalizeInput);
  }
  if (input !== null && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      result[key] = normalizeInput(obj[key]);
    }
    return result;
  }
  return input;
}

function buildCacheKey(agentName: string, input: unknown): string {
  const normalized = normalizeInput(input);
  const canonical = JSON.stringify(normalized);
  const hash = createHash("sha256")
    .update(agentName + ":" + canonical)
    .digest("hex")
    .slice(0, 16);
  return `${agentName}:${hash}`;
}

// ── Cache read/write ──────────────────────────────────────────────────────────

/**
 * Returns the cached result string if it exists and hasn't expired.
 * Lazily deletes expired entries.
 */
export async function checkCache(
  agentName: string,
  input: unknown
): Promise<string | null> {
  try {
    const key = buildCacheKey(agentName, input);
    const row = await prisma.agentCache.findUnique({ where: { cacheKey: key } });
    if (!row) return null;
    if (row.expiresAt < new Date()) {
      // Expired — delete lazily (non-blocking)
      prisma.agentCache.delete({ where: { cacheKey: key } }).catch(() => {});
      return null;
    }
    console.log(`[cache HIT] ${agentName} (expires ${row.expiresAt.toISOString()})`);
    return row.result;
  } catch (err) {
    console.error("[agentMemory] checkCache error:", err);
    return null;
  }
}

/**
 * Saves an agent result to the cache with the appropriate TTL.
 * Uses upsert so re-runs within TTL refresh the entry.
 */
export async function saveCache(
  agentName: string,
  input: unknown,
  result: string
): Promise<void> {
  try {
    const key = buildCacheKey(agentName, input);
    const ttl = AGENT_TTL_MS[agentName] ?? DEFAULT_TTL_MS;
    const expiresAt = new Date(Date.now() + ttl);
    await prisma.agentCache.upsert({
      where: { cacheKey: key },
      update: { result, expiresAt, createdAt: new Date() },
      create: { cacheKey: key, agentName, result, expiresAt },
    });
  } catch (err) {
    console.error("[agentMemory] saveCache error:", err);
  }
}

// ── Ticker extraction ─────────────────────────────────────────────────────────

const TICKER_BLOCKLIST = new Set([
  "AI", "US", "PE", "YTD", "CEO", "CFO", "CTO", "COO", "AND", "THE", "FOR",
  "ETF", "IPO", "SEC", "FCF", "EPS", "RSI", "DCF", "SMA", "EMA", "MACD",
  "GDP", "CPI", "FED", "IMF", "USD", "EUR", "GBP", "BTC", "ETH", "NFT",
  "LTM", "TTM", "NTM", "LBO", "DCF", "IRR", "NPV", "ROE", "ROA", "ROI",
  "WACC", "EBIT", "EBITDA", "GAAP", "CAGR", "OTC", "NYSE", "NASDAQ",
  "ATH", "ATL", "AUM", "NAV", "VIX", "SPX", "TBD", "N/A", "NA",
]);

/**
 * Extract likely stock ticker symbols from a block of text.
 * Matches 2-5 uppercase letter sequences (with optional leading $).
 * Filters common English abbreviations and financial terms.
 */
export function extractTickers(text: string): string[] {
  const matches = text.match(/\b\$?([A-Z]{2,5})\b/g) ?? [];
  return [
    ...new Set(
      matches
        .map((t) => t.replace(/^\$/, ""))
        .filter((t) => !TICKER_BLOCKLIST.has(t))
    ),
  ];
}

// ── Ticker memory (learning) ──────────────────────────────────────────────────

/**
 * Fetches the most recent insights for each ticker and formats them as a
 * "Previous Analysis Memory" block for injection into the CEO system prompt.
 */
export async function getTickerMemory(tickers: string[]): Promise<string> {
  if (!tickers.length) return "";
  try {
    const rows = await Promise.all(
      tickers.map((ticker) =>
        prisma.tickerMemory.findMany({
          where: { ticker: ticker.toUpperCase() },
          orderBy: { createdAt: "desc" },
          take: MAX_INSIGHTS_PER_TICKER,
        })
      )
    );
    const flat = rows.flat();
    if (!flat.length) return "";

    const lines = flat.map((r) => {
      const date = r.createdAt.toISOString().slice(0, 10);
      const src = r.source ? ` · ${r.source}` : "";
      return `[${r.ticker} · ${date}${src}] ${r.insight}`;
    });

    return `## Previous Analysis Memory\nThe following insights were distilled from earlier analyses. Use them to identify what has changed and add longitudinal perspective:\n${lines.join("\n")}`;
  } catch (err) {
    console.error("[agentMemory] getTickerMemory error:", err);
    return "";
  }
}

/**
 * Uses Claude Haiku to extract 3-5 key insights from a completed CEO response,
 * then stores them per ticker. Caps at MAX_INSIGHTS_PER_TICKER per ticker.
 *
 * IMPORTANT: This should be called fire-and-forget (no await at call site).
 * It runs after the response stream has closed, so it adds zero user-visible latency.
 */
export async function saveTickerMemory(
  tickers: string[],
  finalResponse: string,
  anthropicClient: Anthropic
): Promise<void> {
  if (!tickers.length || !finalResponse) return;

  try {
    const response = await anthropicClient.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Extract 3-5 concise investment insights from this analysis report.

Rules:
- Each insight must be 1-2 sentences maximum
- Each insight must start with the ticker it applies to in the format: TICKER: insight text
- Only use tickers from this list: ${tickers.join(", ")}
- Focus on: valuation levels, key risks, technical signals, catalyst timelines, sentiment shifts, or fundamental trends that would be useful in future analysis
- Be specific with numbers when present (e.g. "NVDA DCF fair value ~$850 at 10% WACC")
- Do NOT include general market commentary — only ticker-specific insights

Analysis to extract from:
${finalResponse.slice(0, 3500)}`,
        },
      ],
    });

    const text = (response.content[0] as { type: string; text: string }).text;

    // Parse "TICKER: insight" lines
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^[A-Z]{2,5}:/.test(l));

    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      const ticker = line.slice(0, colonIdx).trim().toUpperCase();
      const insight = line.slice(colonIdx + 1).trim();
      if (!insight || !tickers.includes(ticker)) continue;

      await prisma.tickerMemory.create({
        data: { ticker, insight },
      });

      // Prune to cap: delete oldest entries beyond the limit
      const count = await prisma.tickerMemory.count({ where: { ticker } });
      if (count > MAX_INSIGHTS_PER_TICKER) {
        const oldest = await prisma.tickerMemory.findMany({
          where: { ticker },
          orderBy: { createdAt: "asc" },
          take: count - MAX_INSIGHTS_PER_TICKER,
          select: { id: true },
        });
        await prisma.tickerMemory.deleteMany({
          where: { id: { in: oldest.map((r) => r.id) } },
        });
      }
    }

    console.log(`[memory] Saved ${lines.length} insights for ${tickers.join(", ")}`);
  } catch (err) {
    console.error("[agentMemory] saveTickerMemory error:", err);
  }
}

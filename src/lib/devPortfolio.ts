import type { Holding } from "@/types/portfolio";

// Mock portfolio used only under the dev auth bypass (uid "dev-user"), which
// has no Firebase token and therefore can't read the real Firestore-backed
// portfolio. Gives a realistic, diversified ~$40k book to design against.
//
// Cost basis totals ≈ $40,600 across 10 holdings spanning 7 sectors. Live
// market value will drift from this as quotes load; the portfolio page falls
// back to avgCost when a quote is unavailable.

const SEEDED_AT = "2026-01-02T14:30:00.000Z";

function h(
  ticker: string,
  companyName: string,
  shares: number,
  avgCost: number,
  sector: string
): Holding {
  return {
    id: ticker,
    ticker,
    companyName,
    shares,
    avgCost,
    sector,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  };
}

export const DEV_HOLDINGS: Holding[] = [
  h("AAPL", "Apple Inc.", 25, 190, "Technology"),
  h("MSFT", "Microsoft Corp.", 12, 420, "Technology"),
  h("NVDA", "NVIDIA Corp.", 40, 110, "Technology"),
  h("AMZN", "Amazon.com Inc.", 28, 185, "Consumer Discretionary"),
  h("GOOGL", "Alphabet Inc.", 22, 175, "Communication Services"),
  h("JPM", "JPMorgan Chase & Co.", 18, 200, "Financials"),
  h("V", "Visa Inc.", 16, 280, "Financials"),
  h("XOM", "Exxon Mobil Corp.", 30, 108, "Energy"),
  h("JNJ", "Johnson & Johnson", 20, 150, "Healthcare"),
  h("WMT", "Walmart Inc.", 45, 68, "Consumer Staples"),
];

// Buying power shown alongside the equity book.
export const DEV_CASH = 5000;

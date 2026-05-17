import { anthropic, MODEL } from "@/lib/anthropic";
import { getRecommendationTrends, getPriceTarget, getQuote } from "@/lib/finnhub";

interface AnalystInput {
  tickers: string[];
}

export async function runAnalystAgent(input: unknown): Promise<string> {
  const { tickers } = input as AnalystInput;

  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const [recRes, ptRes, quoteRes] = await Promise.allSettled([
        getRecommendationTrends(ticker),
        getPriceTarget(ticker),
        getQuote(ticker),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec: any =
        recRes.status === "fulfilled" ? (recRes.value as any[])?.[0] ?? null : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pt: any =
        ptRes.status === "fulfilled" ? ptRes.value : null;
      const currentPrice =
        quoteRes.status === "fulfilled" ? quoteRes.value?.price ?? null : null;

      return {
        ticker,
        currentPrice,
        // Finnhub recommendation trend (most recent period)
        strongBuy: rec?.strongBuy ?? null,
        buy: rec?.buy ?? null,
        hold: rec?.hold ?? null,
        sell: rec?.sell ?? null,
        strongSell: rec?.strongSell ?? null,
        period: rec?.period ?? null,
        // Finnhub price target
        targetHigh: pt?.targetHigh ?? null,
        targetLow: pt?.targetLow ?? null,
        targetMean: pt?.targetMean ?? null,
        targetMedian: pt?.targetMedian ?? null,
        numberOfAnalysts: pt?.numberOfAnalysts ?? null,
        lastUpdated: pt?.lastUpdated ?? null,
      };
    })
  );

  const data = results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
    .map((r) => r.value);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are a financial analyst summarizing Wall Street consensus for the following tickers.

Raw analyst data:
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`

For each ticker, compute and present:
1. **Consensus Rating**: Derive from strongBuy/buy/hold/sell/strongSell counts. Express as a weighted score and map to: Strong Buy / Buy / Hold / Sell / Strong Sell.
   Formula: score = (strongBuy×2 + buy×1 + hold×0 + sell×−1 + strongSell×−2) / totalAnalysts
2. **Analyst Count**: Total number of analysts covering the stock.
3. **Avg Price Target**: Use targetMean.
4. **Target Range**: Low – High.
5. **Upside %**: (targetMean − currentPrice) / currentPrice × 100. Flag if > 30% as potentially aggressive.
6. **Rating Distribution**: brief "10 Buy / 5 Hold / 2 Sell" summary.

**Output format:**
1. A markdown table: | Ticker | Rating | Analysts | Avg Target | Range | Upside % |
2. For each ticker with > 20% divergence between targetHigh and targetLow: add a ⚠️ note explaining the wide spread.
3. A 2-3 sentence synthesized takeaway: what does Wall Street think overall about this basket of stocks?

Use "N/A" for missing data. If only one ticker is requested, skip the synthesis and give a 3-sentence single-stock analyst summary instead.`,
      },
    ],
  });

  return (
    response.content.find((b) => b.type === "text")?.text ??
    "Analyst consensus data unavailable."
  );
}

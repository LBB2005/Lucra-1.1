import { anthropic, MODEL } from "@/lib/anthropic";
import { getBasicFinancials, getSnapshots, getPeers } from "@/lib/finnhub";

export async function runCompetitorAgent(input: unknown): Promise<string> {
  const { ticker, peers: inputPeers } = input as { ticker: string; peers?: string[] };

  // Get peers from Finnhub if not provided
  let peers = inputPeers ?? [];
  if (!peers.length) {
    try {
      const peerData = await getPeers(ticker);
      peers = (peerData ?? []).slice(0, 4).filter((p: string) => p !== ticker);
    } catch { /* skip */ }
  }

  const allTickers = [ticker, ...peers];
  const compData: Record<string, object> = {};

  if (process.env.FINNHUB_API_KEY) {
    const snaps = await getSnapshots(allTickers).catch(() => []);

    await Promise.allSettled(
      allTickers.map(async (t) => {
        try {
          const metrics = await getBasicFinancials(t);
          const m = metrics.metric ?? {};
          const snap = snaps.find((s) => s.ticker === t);

          compData[t] = {
            price: snap?.price ?? "N/A",
            change1D: snap ? `${snap.changePct.toFixed(2)}%` : "N/A",
            peRatio: m["peBasicExclExtraTTM"] ?? "N/A",
            pbRatio: m["pbAnnual"] ?? "N/A",
            evEbitda: m["evEbitdaAnnual"] ?? "N/A",
            grossMargin: m["grossMarginTTM"] ? `${m["grossMarginTTM"].toFixed(1)}%` : "N/A",
            netMargin: m["netProfitMarginTTM"] ? `${m["netProfitMarginTTM"].toFixed(1)}%` : "N/A",
            revenueGrowth5Y: m["revenueGrowth5Y"] ? `${(m["revenueGrowth5Y"] * 100).toFixed(1)}%` : "N/A",
            roe: m["roeTTM"] ? `${m["roeTTM"].toFixed(1)}%` : "N/A",
            debtEquity: m["totalDebt/totalEquityAnnual"] ?? "N/A",
          };
        } catch {
          compData[t] = { error: "Data unavailable" };
        }
      })
    );
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2500,
    thinking: { type: "enabled", budget_tokens: 8000 },
    messages: [
      {
        role: "user",
        content: `Compare ${ticker} against peers: ${peers.join(", ")}.\n\n${JSON.stringify(compData, null, 2)}\n\nProvide: relative valuation (cheap/expensive vs peers), margin and profitability comparison, growth comparison, competitive moat assessment for ${ticker}, and overall competitive positioning score (leader/competitive/lagging).`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? (textBlock as { type: string; text: string }).text : "Competitor analysis unavailable.";
}

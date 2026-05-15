import { anthropic, MODEL } from "@/lib/anthropic";
import { getFinancialsReported, getBasicFinancials, getSnapshots } from "@/lib/finnhub";

function runDCF(fcf: number, growthRate: number, terminalGrowthRate: number, wacc: number, years = 10) {
  let pv = 0;
  let f = fcf;
  for (let i = 1; i <= years; i++) {
    f *= 1 + growthRate;
    pv += f / (1 + wacc) ** i;
  }
  const tv = (f * (1 + terminalGrowthRate)) / (wacc - terminalGrowthRate);
  pv += tv / (1 + wacc) ** years;
  return pv;
}

export async function runDcfAgent(input: unknown): Promise<string> {
  const { ticker, wacc = 0.10, growthRate: terminalGrowth = 0.025 } = input as {
    ticker: string; wacc?: number; growthRate?: number;
  };

  let summary = "Financial data unavailable.";

  if (process.env.FINNHUB_API_KEY) {
    try {
      const [metrics, financials, snaps] = await Promise.all([
        getBasicFinancials(ticker),
        getFinancialsReported(ticker, "annual"),
        getSnapshots([ticker]),
      ]);

      const m = metrics.metric ?? {};
      const currentPrice = snaps[0]?.price ?? 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const latestReport = (financials.data ?? [])[0]?.report ?? {};
      const cf = latestReport.cf ?? {};
      const ic = latestReport.ic ?? {};

      const operatingCF = cf.find((x: { concept: string }) => x.concept === "NetCashProvidedByUsedInOperatingActivities")?.value ?? 0;
      const capex = Math.abs(cf.find((x: { concept: string }) => x.concept === "PaymentsToAcquirePropertyPlantAndEquipment")?.value ?? 0);
      const fcf = operatingCF - capex;

      const revenue = ic.find((x: { concept: string }) => x.concept === "Revenues")?.value ?? 0;
      const netIncome = ic.find((x: { concept: string }) => x.concept === "NetIncomeLoss")?.value ?? 0;

      const sharesOutstanding = m["shareOutstanding"] ?? 1;
      let dcfPerShare: number | null = null;
      if (fcf > 0 && sharesOutstanding > 0) {
        const ev = runDCF(fcf, 0.07, terminalGrowth, wacc);
        dcfPerShare = ev / sharesOutstanding;
      }

      summary = JSON.stringify({
        ticker,
        currentPrice,
        revenue: revenue ? `$${(revenue / 1e9).toFixed(2)}B` : "N/A",
        netIncome: netIncome ? `$${(netIncome / 1e9).toFixed(2)}B` : "N/A",
        freeCashFlow: fcf ? `$${(fcf / 1e9).toFixed(2)}B` : "N/A",
        peRatio: m["peBasicExclExtraTTM"] ?? "N/A",
        evEbitda: m["currentEv/freeCashFlowAnnual"] ?? "N/A",
        revenueGrowth: m["revenueGrowth5Y"] ? `${(m["revenueGrowth5Y"] * 100).toFixed(1)}%` : "N/A",
        grossMargin: m["grossMarginTTM"] ? `${(m["grossMarginTTM"]).toFixed(1)}%` : "N/A",
        dcfEstimatePerShare: dcfPerShare ? `$${dcfPerShare.toFixed(2)}` : "Negative FCF — cannot model",
        impliedUpside: dcfPerShare && currentPrice > 0
          ? `${(((dcfPerShare - currentPrice) / currentPrice) * 100).toFixed(1)}%`
          : "N/A",
        assumptions: { wacc: `${(wacc * 100).toFixed(1)}%`, terminalGrowth: `${(terminalGrowth * 100).toFixed(1)}%` },
      }, null, 2);
    } catch {
      summary = `Could not fetch financials for ${ticker}.`;
    }
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2500,
    thinking: { type: "enabled", budget_tokens: 8000 },
    messages: [
      {
        role: "user",
        content: `Perform a DCF valuation for ${ticker}.\n\n${summary}\n\nProvide: financial health summary, DCF assumption assessment, fair value range (bear/base/bull), valuation risks, and buy/hold/sell signal vs current price. Note: not financial advice.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? (textBlock as { type: string; text: string }).text : "DCF unavailable.";
}

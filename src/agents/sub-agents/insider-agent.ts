import { anthropic, MODEL } from "@/lib/anthropic";
import { getInsiderTransactions } from "@/lib/finnhub";

export async function runInsiderAgent(input: unknown): Promise<string> {
  const { tickers } = input as { tickers: string[] };

  const insiderData: Record<string, object> = {};

  await Promise.allSettled(
    tickers.map(async (ticker) => {
      try {
        const data = await getInsiderTransactions(ticker);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transactions = (data.data ?? []).slice(0, 15).map((t: any) => ({
          name: t.name,
          change: t.change,
          transactionPrice: t.transactionPrice,
          transactionDate: t.transactionDate,
          transactionCode: t.transactionCode, // P=purchase, S=sale
          share: t.share,
        }));

        const buys = transactions.filter((t: { transactionCode: string }) => t.transactionCode === "P").length;
        const sells = transactions.filter((t: { transactionCode: string }) => t.transactionCode === "S").length;

        insiderData[ticker] = {
          recentTransactions: transactions.slice(0, 10),
          summary: { buys, sells, ratio: sells > 0 ? `${(buys / sells).toFixed(1)}x buy/sell` : "All buys" },
        };
      } catch {
        insiderData[ticker] = { error: "Could not fetch insider data" };
      }
    })
  );

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `Analyze insider trading activity for ${tickers.join(", ")}.\n\n${JSON.stringify(insiderData, null, 2)}\n\nProvide: notable buys/sells, what insider activity signals about management conviction, any red or green flags, and overall insider sentiment (bullish/bearish/neutral) per ticker.`,
      },
    ],
  });

  return (response.content[0] as { type: string; text: string }).text;
}

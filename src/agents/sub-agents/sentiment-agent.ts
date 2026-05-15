import { anthropic, MODEL } from "@/lib/anthropic";

async function fetchStockTwitsSentiment(ticker: string) {
  try {
    const res = await fetch(
      `https://api.stocktwits.com/api/2/streams/symbol/${ticker}.json`,
      { headers: { "User-Agent": "Lucra App" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages = (data.messages ?? []).slice(0, 20);
    const bullish = messages.filter((m: any) => m.entities?.sentiment?.basic === "Bullish").length;
    const bearish = messages.filter((m: any) => m.entities?.sentiment?.basic === "Bearish").length;
    return {
      total: messages.length,
      bullish,
      bearish,
      neutral: messages.length - bullish - bearish,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentMessages: messages.slice(0, 5).map((m: any) => m.body?.slice(0, 100)),
    };
  } catch {
    return null;
  }
}

async function fetchRedditSentiment(ticker: string) {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const userAgent = process.env.REDDIT_USER_AGENT ?? "lucra-app/1.0";

  if (!clientId || !clientSecret) return null;

  try {
    // Get Reddit access token
    const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": userAgent,
      },
      body: "grant_type=client_credentials",
    });
    if (!tokenRes.ok) return null;
    const { access_token } = await tokenRes.json();

    const searchRes = await fetch(
      `https://oauth.reddit.com/search?q=${ticker}&subreddit=wallstreetbets+stocks+investing&sort=new&limit=25&t=week`,
      { headers: { Authorization: `Bearer ${access_token}`, "User-Agent": userAgent } }
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posts = (searchData.data?.children ?? []).map((p: any) => ({
      title: p.data?.title?.slice(0, 100),
      score: p.data?.score,
      subreddit: p.data?.subreddit,
    }));

    return { posts: posts.slice(0, 10), totalFound: posts.length };
  } catch {
    return null;
  }
}

export async function runSentimentAgent(input: unknown): Promise<string> {
  const { tickers } = input as { tickers: string[] };

  const sentimentData: Record<string, object> = {};

  await Promise.allSettled(
    tickers.map(async (ticker) => {
      const [stocktwits, reddit] = await Promise.all([
        fetchStockTwitsSentiment(ticker),
        fetchRedditSentiment(ticker),
      ]);
      sentimentData[ticker] = {
        stocktwits: stocktwits ?? "Not available",
        reddit: reddit ?? "Not available (configure REDDIT_CLIENT_ID/SECRET)",
      };
    })
  );

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `Analyze social sentiment for ${tickers.join(", ")} based on StockTwits and Reddit data.

Sentiment data:
${JSON.stringify(sentimentData, null, 2)}

Provide:
1. Overall sentiment score for each ticker (bullish/bearish/neutral with confidence)
2. Retail investor interest level (high/medium/low)
3. Notable themes or narratives in the social data
4. Any contrarian signals (extremely bullish = potential top, extremely bearish = potential bottom)
5. How social sentiment aligns with or diverges from fundamentals

Be specific about what the data shows.`,
      },
    ],
  });

  return (response.content[0] as { type: string; text: string }).text;
}

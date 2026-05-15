const BASE = "https://api.perplexity.ai";
const KEY = process.env.PERPLEXITY_API_KEY;

export async function perplexitySearch(
  prompt: string,
  model: "sonar-pro" | "sonar" = "sonar-pro"
): Promise<string> {
  if (!KEY) return "Perplexity API key not configured.";

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a financial research assistant. Provide concise, accurate, up-to-date financial analysis with specific data points and sources where available.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 2000,
    }),
  });

  if (!res.ok) throw new Error(`Perplexity ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "No response";
}

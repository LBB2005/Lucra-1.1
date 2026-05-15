import { NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/anthropic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const isPdf = file.type === "application/pdf";

    const extractPrompt = `Extract all stock and ETF holdings from this brokerage/portfolio statement.
Return ONLY a JSON array with this exact shape:
[{"ticker":"AAPL","companyName":"Apple Inc.","shares":10.0,"avgCost":150.00}]

Rules:
- ticker: stock symbol (string, uppercase, required)
- companyName: full company name or null if not shown
- shares: number of shares owned (float, required)
- avgCost: average cost per share in USD (float, use null if not shown)
- Include stocks and ETFs only — skip bonds, options, cash, and money market funds
- If cost basis shows total cost (not per share), divide by shares to get per-share cost
- Return only the JSON array, no other text`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentBlock: any = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: file.type, data: base64 } };

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [contentBlock, { type: "text", text: extractPrompt }],
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ?.text as string | undefined;

    if (!text) return NextResponse.json({ error: "No response from AI" }, { status: 500 });

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ error: "Could not parse holdings from statement" }, { status: 422 });

    const holdings = JSON.parse(match[0]);
    return NextResponse.json({ holdings });
  } catch (err) {
    console.error("[statement POST]", err);
    return NextResponse.json({ error: "Failed to process statement" }, { status: 500 });
  }
}

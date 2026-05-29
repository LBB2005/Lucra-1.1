import { NextResponse } from "next/server";
import { getSnapshots } from "@/lib/finnhub";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("tickers") ?? "";
  const tickers = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (!tickers.length) return NextResponse.json([]);

  if (!process.env.FINNHUB_API_KEY) {
    return NextResponse.json(
      { error: "Quote service not configured (FINNHUB_API_KEY missing)." },
      { status: 503 }
    );
  }

  try {
    const snapshots = await getSnapshots(tickers);
    return NextResponse.json(snapshots);
  } catch (err) {
    console.error("[quotes]", err);
    return NextResponse.json({ error: "Failed to fetch quotes" }, { status: 500 });
  }
}

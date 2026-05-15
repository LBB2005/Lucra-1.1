import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const holdings = await prisma.holding.findMany({
      orderBy: { ticker: "asc" },
    });
    return NextResponse.json(holdings);
  } catch (err) {
    console.error("[portfolio GET]", err);
    return NextResponse.json({ error: "Failed to load portfolio" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ticker, companyName, shares, avgCost, sector } = body;

    if (!ticker || typeof shares !== "number" || typeof avgCost !== "number") {
      return NextResponse.json({ error: "ticker, shares, and avgCost are required" }, { status: 400 });
    }

    const holding = await prisma.holding.upsert({
      where: { ticker: ticker.toUpperCase() },
      update: { shares, avgCost, companyName: companyName ?? null, sector: sector ?? null },
      create: {
        ticker: ticker.toUpperCase(),
        companyName: companyName ?? null,
        shares,
        avgCost,
        sector: sector ?? null,
      },
    });

    return NextResponse.json(holding, { status: 201 });
  } catch (err) {
    console.error("[portfolio POST]", err);
    return NextResponse.json({ error: "Failed to save holding" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBrokerCsv } from "@/lib/csv-parser";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const holdings = parseBrokerCsv(text);

    if (!holdings.length) {
      return NextResponse.json({ error: "No valid holdings found in CSV" }, { status: 400 });
    }

    const results = await Promise.allSettled(
      holdings.map((h) =>
        prisma.holding.upsert({
          where: { ticker: h.ticker },
          update: {
            shares: h.shares,
            avgCost: h.avgCost,
            ...(h.companyName && { companyName: h.companyName }),
            ...(h.sector && { sector: h.sector }),
          },
          create: {
            ticker: h.ticker,
            shares: h.shares,
            avgCost: h.avgCost,
            companyName: h.companyName ?? null,
            sector: h.sector ?? null,
          },
        })
      )
    );

    const imported = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ imported, failed, total: holdings.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to parse CSV";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

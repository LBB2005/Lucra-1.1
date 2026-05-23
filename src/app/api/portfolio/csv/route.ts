import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/requireAuth";
import { parseBrokerCsv } from "@/lib/csv-parser";

export async function POST(req: Request) {
  const { userId, error } = await requireAuth();
  if (error) return error;
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

    const holdingsCol = db.collection("users").doc(userId).collection("holdings");
    const now = new Date().toISOString();

    const results = await Promise.allSettled(
      holdings.map(async (h) => {
        const docRef = holdingsCol.doc(h.ticker);
        const existing = await docRef.get();
        if (existing.exists) {
          await docRef.update({
            shares: h.shares,
            avgCost: h.avgCost,
            ...(h.companyName && { companyName: h.companyName }),
            ...(h.sector && { sector: h.sector }),
            updatedAt: now,
          });
        } else {
          await docRef.set({
            userId,
            ticker: h.ticker,
            shares: h.shares,
            avgCost: h.avgCost,
            companyName: h.companyName ?? null,
            sector: h.sector ?? null,
            createdAt: now,
            updatedAt: now,
          });
        }
      })
    );

    const imported = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ imported, failed, total: holdings.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to parse CSV";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

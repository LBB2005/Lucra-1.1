import { NextResponse } from "next/server";
import { db, serializeDoc } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/requireAuth";
import { FieldValue } from "firebase-admin/firestore";

function holdingsCol(uid: string) {
  return db.collection("users").doc(uid).collection("holdings");
}

export async function GET() {
  const { userId, error } = await requireAuth();
  if (error) return error;
  try {
    const snap = await holdingsCol(userId).orderBy("ticker").get();
    const holdings = snap.docs.map((doc) => serializeDoc(doc.id, doc.data()));
    return NextResponse.json(holdings);
  } catch (err) {
    console.error("[portfolio GET]", err);
    return NextResponse.json({ error: "Failed to load portfolio" }, { status: 500 });
  }
}

export async function DELETE() {
  const { userId, error } = await requireAuth();
  if (error) return error;
  try {
    const snap = await holdingsCol(userId).get();
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[portfolio DELETE]", err);
    return NextResponse.json({ error: "Failed to clear portfolio" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { userId, error } = await requireAuth();
  if (error) return error;
  try {
    const body = await req.json();
    const { ticker, companyName, shares, avgCost, sector } = body;

    if (!ticker || typeof shares !== "number" || typeof avgCost !== "number") {
      return NextResponse.json({ error: "ticker, shares, and avgCost are required" }, { status: 400 });
    }
    if (shares <= 0) {
      return NextResponse.json({ error: "shares must be positive" }, { status: 400 });
    }
    if (avgCost <= 0) {
      return NextResponse.json({ error: "avgCost must be positive" }, { status: 400 });
    }

    const upperTicker = ticker.toUpperCase();
    const docRef = holdingsCol(userId).doc(upperTicker);
    const existing = await docRef.get();
    const now = new Date().toISOString();

    if (existing.exists) {
      await docRef.update({
        shares,
        avgCost,
        companyName: companyName ?? null,
        sector: sector ?? null,
        updatedAt: now,
      });
    } else {
      await docRef.set({
        userId,
        ticker: upperTicker,
        companyName: companyName ?? null,
        shares,
        avgCost,
        sector: sector ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }

    const updated = await docRef.get();
    return NextResponse.json(serializeDoc(updated.id, updated.data()!), { status: 201 });
  } catch (err) {
    console.error("[portfolio POST]", err);
    return NextResponse.json({ error: "Failed to save holding" }, { status: 500 });
  }
}

// Suppress TS unused import warning
void FieldValue;

import { NextResponse } from "next/server";
import { db, serializeDoc } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/requireAuth";

function holdingDoc(uid: string, id: string) {
  return db.collection("users").doc(uid).collection("holdings").doc(id);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireAuth();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await req.json();
    const { shares, avgCost, companyName, sector } = body;

    if (shares !== undefined && shares <= 0) {
      return NextResponse.json({ error: "shares must be positive" }, { status: 400 });
    }
    if (avgCost !== undefined && avgCost <= 0) {
      return NextResponse.json({ error: "avgCost must be positive" }, { status: 400 });
    }

    const docRef = holdingDoc(userId, id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Holding not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (shares !== undefined) updates.shares = shares;
    if (avgCost !== undefined) updates.avgCost = avgCost;
    if (companyName !== undefined) updates.companyName = companyName;
    if (sector !== undefined) updates.sector = sector;

    await docRef.update(updates);
    const updated = await docRef.get();
    return NextResponse.json(serializeDoc(updated.id, updated.data()!));
  } catch (err) {
    console.error("[portfolio PATCH]", err);
    return NextResponse.json({ error: "Failed to update holding" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireAuth();
  if (error) return error;
  try {
    const { id } = await params;
    const docRef = holdingDoc(userId, id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Holding not found" }, { status: 404 });
    }
    await docRef.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[portfolio DELETE]", err);
    return NextResponse.json({ error: "Failed to delete holding" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db, serializeDoc } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/requireAuth";

function briefingsCol(uid: string) {
  return db.collection("users").doc(uid).collection("briefings");
}

// GET /api/briefing — fetch the latest unread + recent briefings
export async function GET() {
  const { userId, error } = await requireAuth();
  if (error) return error;
  try {
    const snap = await briefingsCol(userId)
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    const briefings = snap.docs.map((doc) => {
      const data = serializeDoc(doc.id, doc.data());
      return {
        ...data,
        tickers: JSON.parse((data.tickers as string) || "[]") as string[],
      };
    });

    return NextResponse.json(briefings);
  } catch (err) {
    console.error("[briefing GET]", err);
    return NextResponse.json({ error: "Failed to load briefings" }, { status: 500 });
  }
}

// PATCH /api/briefing — mark a briefing as read
export async function PATCH(req: Request) {
  const { userId, error } = await requireAuth();
  if (error) return error;
  try {
    const { id } = await req.json();
    const docRef = briefingsCol(userId).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Briefing not found" }, { status: 404 });
    }
    await docRef.update({ readAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[briefing PATCH]", err);
    return NextResponse.json({ error: "Failed to mark briefing read" }, { status: 500 });
  }
}

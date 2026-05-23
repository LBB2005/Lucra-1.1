import { NextResponse } from "next/server";
import { db, serializeDoc } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/requireAuth";

function convDoc(uid: string, id: string) {
  return db.collection("users").doc(uid).collection("conversations").doc(id);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireAuth();
  if (error) return error;
  try {
    const { id } = await params;
    const docRef = convDoc(userId, id);
    // Delete all messages first
    const msgSnap = await docRef.collection("messages").get();
    const batch = db.batch();
    msgSnap.docs.forEach((m) => batch.delete(m.ref));
    batch.delete(docRef);
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[conversation DELETE]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await requireAuth();
  if (error) return error;
  try {
    const { id } = await params;
    const { title } = await req.json();
    const docRef = convDoc(userId, id);
    await docRef.update({ title, updatedAt: new Date().toISOString() });
    const snap = await docRef.get();
    return NextResponse.json(serializeDoc(snap.id, snap.data()!));
  } catch (err) {
    console.error("[conversation PATCH]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { adminAuth, db } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/requireAuth";

export async function GET() {
  const { userId, error } = await requireAuth();
  if (error) return error;
  try {
    const [firebaseUser, settingsDoc, convSnap, briefingSnap] = await Promise.all([
      adminAuth.getUser(userId),
      db.collection("userSettings").doc(userId).get(),
      db.collection("users").doc(userId).collection("conversations").select().get(),
      db.collection("users").doc(userId).collection("briefings").select().get(),
    ]);

    const settings = settingsDoc.exists ? settingsDoc.data() : {};

    return NextResponse.json({
      uid: userId,
      name: firebaseUser.displayName ?? null,
      email: firebaseUser.email ?? null,
      photoURL: firebaseUser.photoURL ?? null,
      createdAt: firebaseUser.metadata.creationTime ?? null,
      plan: (settings?.plan as string) ?? "Pro",
      allowDataTraining: (settings?.allowDataTraining as boolean) ?? true,
      locationMetadata: (settings?.locationMetadata as boolean) ?? true,
      stats: {
        conversations: convSnap.size,
        briefings: briefingSnap.size,
      },
    });
  } catch (err) {
    console.error("[user GET]", err);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { userId, error } = await requireAuth();
  if (error) return error;
  try {
    const body = await request.json() as Record<string, unknown>;
    const settingsUpdate: Record<string, unknown> = {};

    for (const key of ["plan", "allowDataTraining", "locationMetadata"]) {
      if (key in body) settingsUpdate[key] = body[key];
    }

    if (typeof body.displayName === "string") {
      await adminAuth.updateUser(userId, { displayName: body.displayName });
    }

    if (Object.keys(settingsUpdate).length > 0) {
      await db.collection("userSettings").doc(userId).set(settingsUpdate, { merge: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[user PATCH]", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/requireAuth";

function settingsDoc(uid: string) {
  return db.collection("users").doc(uid).collection("portfolioSettings").doc("default");
}

async function getOrCreate(uid: string) {
  const docRef = settingsDoc(uid);
  const snap = await docRef.get();
  if (!snap.exists) {
    const data = { cashBalance: 0, updatedAt: new Date().toISOString() };
    await docRef.set(data);
    return data;
  }
  return snap.data()!;
}

export async function GET() {
  const { userId, error } = await requireAuth();
  if (error) return error;
  try {
    const settings = await getOrCreate(userId);
    return NextResponse.json(settings);
  } catch (err) {
    console.error("[settings GET]", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { userId, error } = await requireAuth();
  if (error) return error;
  try {
    const { cashBalance } = await req.json();
    if (typeof cashBalance !== "number" || cashBalance < 0) {
      return NextResponse.json({ error: "cashBalance must be a non-negative number" }, { status: 400 });
    }
    const docRef = settingsDoc(userId);
    const snap = await docRef.get();
    const now = new Date().toISOString();
    if (snap.exists) {
      await docRef.update({ cashBalance, updatedAt: now });
    } else {
      await docRef.set({ cashBalance, updatedAt: now });
    }
    return NextResponse.json({ cashBalance, updatedAt: now });
  } catch (err) {
    console.error("[settings PATCH]", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}

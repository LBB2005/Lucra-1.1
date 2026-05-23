import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export async function requireAuth(): Promise<
  { userId: string; error?: never } | { userId?: never; error: NextResponse }
> {
  const headersList = await headers();
  const authHeader = headersList.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const token = authHeader.slice(7);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { userId: decoded.uid };
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}

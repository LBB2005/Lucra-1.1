import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

export const adminAuth = admin.auth();
export const db = admin.firestore();

/** Convert a Firestore Timestamp (or Date) to an ISO string, or null. */
export function tsToISO(
  val: admin.firestore.Timestamp | Date | null | undefined
): string | null {
  if (!val) return null;
  if (val instanceof admin.firestore.Timestamp) return val.toDate().toISOString();
  return (val as Date).toISOString();
}

/** Serialize a Firestore document, converting all Timestamps to ISO strings. */
export function serializeDoc(
  id: string,
  data: admin.firestore.DocumentData
): Record<string, unknown> {
  const result: Record<string, unknown> = { id };
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof admin.firestore.Timestamp) {
      result[key] = value.toDate().toISOString();
    } else {
      result[key] = value;
    }
  }
  return result;
}

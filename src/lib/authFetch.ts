"use client";
import { auth } from "@/lib/firebase";

/** Get the current Firebase ID token, or null if not signed in. */
export async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

/** Wrapper around fetch() that automatically adds the Firebase Bearer token. */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

/** SWR-compatible fetcher that includes the Firebase auth token. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const authFetcher = async <T = any>(url: string): Promise<T> => {
  const res = await authFetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as T;
};

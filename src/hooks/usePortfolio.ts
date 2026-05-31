"use client";
import useSWR from "swr";
import type { Holding } from "@/types/portfolio";
import { authFetch, authFetcher } from "@/lib/authFetch";
import { useAuth } from "@/context/AuthContext";
import { DEV_HOLDINGS, DEV_CASH } from "@/lib/devPortfolio";

export function usePortfolio() {
  // The dev auth bypass user has no Firebase token, so the Firestore-backed
  // portfolio API returns 401. Serve a mock book instead of fetching.
  const { devBypass } = useAuth();
  const isDevMock = devBypass;

  const { data, error, isLoading, mutate } = useSWR<Holding[]>(
    isDevMock ? null : "/api/portfolio",
    authFetcher,
    { revalidateOnFocus: false }
  );

  const { data: settingsData, mutate: mutateSettings } = useSWR<{ cashBalance: number }>(
    isDevMock ? null : "/api/portfolio/settings",
    authFetcher,
    { revalidateOnFocus: false }
  );

  async function setCashBalance(cashBalance: number) {
    await authFetch("/api/portfolio/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cashBalance }),
    });
    await mutateSettings();
  }

  async function addHolding(holding: Omit<Holding, "id" | "createdAt" | "updatedAt">) {
    const res = await authFetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(holding),
    });
    if (!res.ok) throw new Error("Failed to add holding");
    await mutate();
  }

  async function removeHolding(id: string) {
    const res = await authFetch(`/api/portfolio/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to remove holding");
    await mutate();
  }

  async function uploadCsv(file: File): Promise<{ imported: number; failed: number }> {
    const form = new FormData();
    form.append("file", file);
    const res = await authFetch("/api/portfolio/csv", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    await mutate();
    return data;
  }

  return {
    holdings: isDevMock ? DEV_HOLDINGS : (Array.isArray(data) ? data : []),
    cashBalance: isDevMock ? DEV_CASH : (settingsData?.cashBalance ?? 0),
    error,
    isLoading,
    mutate,
    addHolding,
    removeHolding,
    uploadCsv,
    setCashBalance,
  };
}

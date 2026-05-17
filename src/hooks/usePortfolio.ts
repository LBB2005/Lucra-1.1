"use client";
import useSWR from "swr";
import type { Holding } from "@/types/portfolio";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

export function usePortfolio() {
  const { data, error, isLoading, mutate } = useSWR<Holding[]>(
    "/api/portfolio",
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: settingsData, mutate: mutateSettings } = useSWR<{ cashBalance: number }>(
    "/api/portfolio/settings",
    fetcher,
    { revalidateOnFocus: false }
  );

  async function setCashBalance(cashBalance: number) {
    await fetch("/api/portfolio/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cashBalance }),
    });
    await mutateSettings();
  }

  async function addHolding(holding: Omit<Holding, "id" | "createdAt" | "updatedAt">) {
    const res = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(holding),
    });
    if (!res.ok) throw new Error("Failed to add holding");
    await mutate();
  }

  async function removeHolding(id: string) {
    const res = await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to remove holding");
    await mutate();
  }

  async function uploadCsv(file: File): Promise<{ imported: number; failed: number }> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/portfolio/csv", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Upload failed");
    await mutate();
    return data;
  }

  return {
    holdings: Array.isArray(data) ? data : [],
    cashBalance: settingsData?.cashBalance ?? 0,
    error,
    isLoading,
    mutate,
    addHolding,
    removeHolding,
    uploadCsv,
    setCashBalance,
  };
}

const EDGAR_BASE = "https://data.sec.gov";
const USER_AGENT = "Lucra App liamblackshawbrown@gmail.com";

async function edgarFetch(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`EDGAR ${res.status}: ${url}`);
  return res.json();
}

// Resolve ticker → CIK using EDGAR company search
export async function getCikByTicker(ticker: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22${ticker}%22&dateRange=custom&startdt=2020-01-01&forms=10-K`,
      { headers: { "User-Agent": USER_AGENT } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data.hits?.hits?.[0];
    if (!hit) return null;
    return hit._source?.entity_id ?? null;
  } catch {
    return null;
  }
}

export async function getCompanyFacts(cik: string) {
  const padded = cik.toString().padStart(10, "0");
  return edgarFetch(`${EDGAR_BASE}/api/xbrl/companyfacts/CIK${padded}.json`);
}

export async function getRecentFilings(cik: string) {
  const padded = cik.toString().padStart(10, "0");
  return edgarFetch(`${EDGAR_BASE}/submissions/CIK${padded}.json`);
}

// Extract key financial metrics from company facts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractFinancialMetrics(facts: any) {
  const us = facts?.facts?.["us-gaap"] ?? {};
  const pick = (key: string) => {
    const units = us[key]?.units?.USD ?? us[key]?.units?.shares ?? [];
    // Get most recent annual value
    const annual = units.filter((u: { form: string }) => u.form === "10-K");
    return annual.at(-1)?.val ?? null;
  };

  return {
    revenue: pick("Revenues") ?? pick("RevenueFromContractWithCustomerExcludingAssessedTax"),
    netIncome: pick("NetIncomeLoss"),
    totalAssets: pick("Assets"),
    totalDebt: pick("LongTermDebt"),
    freeCashFlow: pick("NetCashProvidedByUsedInOperatingActivities"),
    sharesOutstanding: pick("CommonStockSharesOutstanding"),
  };
}

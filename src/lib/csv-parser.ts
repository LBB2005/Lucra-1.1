import Papa from "papaparse";
import type { HoldingFormData } from "@/types/portfolio";

const TICKER_ALIASES = ["symbol", "ticker", "stock symbol", "stock"];
const SHARES_ALIASES = ["quantity", "shares", "units", "qty", "amount"];
const COST_ALIASES = ["avg cost", "average cost", "cost basis", "avg price", "average price", "price paid", "unit cost"];
const NAME_ALIASES = ["name", "company", "description", "security name", "company name"];
const SECTOR_ALIASES = ["sector", "industry", "category", "asset class"];

function findCol(headers: string[], aliases: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias);
    if (idx !== -1) return idx;
  }
  // Partial match fallback
  for (const alias of aliases) {
    const idx = lower.findIndex((h) => h.includes(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseBrokerCsv(csvText: string): HoldingFormData[] {
  const result = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
  });

  const rows = result.data as string[][];
  if (rows.length < 2) throw new Error("CSV must have at least a header row and one data row");

  const headers = rows[0];
  const tickerIdx = findCol(headers, TICKER_ALIASES);
  const sharesIdx = findCol(headers, SHARES_ALIASES);
  const costIdx = findCol(headers, COST_ALIASES);
  const nameIdx = findCol(headers, NAME_ALIASES);
  const sectorIdx = findCol(headers, SECTOR_ALIASES);

  if (tickerIdx === -1) throw new Error("Could not find ticker/symbol column in CSV");
  if (sharesIdx === -1) throw new Error("Could not find shares/quantity column in CSV");

  const holdings: HoldingFormData[] = [];

  for (const row of rows.slice(1)) {
    const ticker = row[tickerIdx]?.trim().toUpperCase().replace(/[^A-Z.]/g, "");
    if (!ticker || ticker.length < 1 || ticker.length > 6) continue;

    const sharesRaw = row[sharesIdx]?.replace(/[,$]/g, "") ?? "0";
    const shares = parseFloat(sharesRaw);
    if (isNaN(shares) || shares <= 0) continue;

    const costRaw = costIdx !== -1 ? row[costIdx]?.replace(/[,$]/g, "") ?? "0" : "0";
    const avgCost = parseFloat(costRaw);

    holdings.push({
      ticker,
      companyName: nameIdx !== -1 ? row[nameIdx]?.trim() : undefined,
      shares,
      avgCost: isNaN(avgCost) ? 0 : avgCost,
      sector: sectorIdx !== -1 ? row[sectorIdx]?.trim() : undefined,
    });
  }

  return holdings;
}

export interface Holding {
  id: string;
  ticker: string;
  companyName: string | null;
  shares: number;
  avgCost: number;
  sector: string | null;
  createdAt: string;
  updatedAt: string;
  // enriched client-side
  currentPrice?: number;
  marketValue?: number;
  gainLoss?: number;
  gainLossPct?: number;
  portfolioPct?: number;
}

export interface HoldingFormData {
  ticker: string;
  companyName?: string;
  shares: number;
  avgCost: number;
  sector?: string;
}

export interface Quote {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  volume?: number;
  timestamp?: number;
}

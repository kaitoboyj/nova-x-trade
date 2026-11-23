import { queryOptions } from "@tanstack/react-query";
import type { GlobalMarket } from "./global-market";

export interface Coin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  circulating_supply: number;
  sparkline_in_7d?: { price: number[] };
}

const BASE = "https://api.coingecko.com/api/v3";

export async function fetchMarkets(perPage = 100): Promise<Coin[]> {
  const res = await fetch(`/api/markets?per_page=${perPage}`);
  if (!res.ok) throw new Error("Failed to fetch markets");
  return res.json();
}


export const marketsQuery = (perPage = 50) =>
  queryOptions({
    queryKey: ["markets", perPage],
    queryFn: () => fetchMarkets(perPage),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

export const globalMarketQuery = queryOptions({
  queryKey: ["global-crypto-market"],
  queryFn: async (): Promise<GlobalMarket> => {
    const response = await fetch("/api/markets?scope=global", { cache: "no-store" });
    if (!response.ok) throw new Error("Global market data temporarily unavailable");
    return response.json();
  },
  staleTime: 30_000,
  refetchInterval: 30_000,
});

export function formatUSD(n: number, opts: Intl.NumberFormatOptions = {}) {
  if (!Number.isFinite(n)) return "$—";
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  // A lone `maximumFractionDigits` (e.g. whole-dollar readouts) must not leave
  // `minimumFractionDigits` above it, which throws a RangeError.
  const maximumFractionDigits = opts.maximumFractionDigits ?? digits;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    ...opts,
    minimumFractionDigits: opts.minimumFractionDigits ?? maximumFractionDigits,
    maximumFractionDigits,
  }).format(n);
}

export function formatCompact(n: number) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatPct(n: number | undefined | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

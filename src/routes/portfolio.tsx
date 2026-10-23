import { brandPreviewMeta } from "@/lib/brand";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, PieChart, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { fetchBalance, type Balance } from "@/lib/balances";
import { fetchWalletTokens, type WalletToken } from "@/lib/tokens";
import { marketsQuery, formatUSD } from "@/lib/prices";
import { useWalletAccounts, useWalletSession } from "@/hooks/useWalletSession";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...brandPreviewMeta,
      { title: "Portfolio — PrimeCapital" },
      {
        name: "description",
        content:
          "See your combined holdings across every account, allocation by asset, and 24h performance.",
      },
      { property: "og:title", content: "Portfolio — PrimeCapital" },
      {
        property: "og:description",
        content: "Combined holdings, allocation and 24h performance across your accounts.",
      },
    ],
  }),
  component: PortfolioPage,
});

const PRICE_SYMBOL: Record<string, string> = {
  BTC: "btc",
  BTC_LEGACY: "btc",
  ETH: "eth",
  BNB: "bnb",
  MATIC: "pol",
  BASE: "eth",
  ARB: "eth",
  OP: "eth",
  AVAX: "avax",
  SOL: "sol",
};

interface Holding {
  key: string;
  chain: string;
  symbol: string;
  amount: number;
  price: number;
  usd: number;
  change24h: number;
}

const SLICE_COLORS = [
  "#f59e0b",
  "#3b82f6",
  "#10b981",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#eab308",
  "#ec4899",
];

function AllocationDonut({ holdings }: { holdings: Holding[] }) {
  const top = holdings.slice(0, 7);
  const restTotal = holdings.slice(7).reduce((s, h) => s + h.usd, 0);
  const slices = restTotal > 0 ? [...top, { ...top[0], key: "__rest", symbol: "Other", usd: restTotal, amount: 0, chain: "", price: 0, change24h: 0 }] : top;
  const total = slices.reduce((s, h) => s + h.usd, 0);
  if (total <= 0) return null;

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0 -rotate-90">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--border)" strokeWidth="16" />
        {slices.map((h, i) => {
          const fraction = h.usd / total;
          const dash = fraction * circumference;
          const el = (
            <circle
              key={h.key}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={SLICE_COLORS[i % SLICE_COLORS.length]}
              strokeWidth="16"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((h, i) => (
          <li key={h.key} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
              />
              <span className="truncate text-foreground">{h.symbol}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              {((h.usd / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PortfolioPage() {
  const session = useWalletSession();
  const accounts = useWalletAccounts();
  const { data: markets } = useQuery(marketsQuery(250));
  const [holdings, setHoldings] = useState<Holding[] | null>(null);

  const priceBySymbol = useMemo(() => {
    const map = new Map<string, { price: number; change: number }>();
    for (const c of markets ?? []) {
      map.set(c.symbol.toLowerCase(), {
        price: c.current_price,
        change: Number(c.price_change_percentage_24h ?? 0),
      });
    }
    const pol = map.get("pol") ?? map.get("matic");
    if (pol) {
      map.set("pol", pol);
      map.set("matic", pol);
    }
    return map;
  }, [markets]);

  const targets = useMemo(
    () =>
      accounts.map((a) => ({
        walletKey: a.address,
        addresses: (a.wallet?.addresses ?? []).map((x) => ({ chain: x.chain, address: x.address })),
      })),
    [accounts],
  );

  useEffect(() => {
    if (!targets.some((t) => t.addresses.length)) {
      setHoldings([]);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const buckets = new Map<string, Holding>();
      const add = (chain: string, symbol: string, amount: number, price: number, change: number, chainName: string) => {
        if (!Number.isFinite(amount) || amount <= 0) return;
        const key = `${chain}:${symbol}`;
        const prev = buckets.get(key);
        const usd = amount * price;
        if (prev) {
          prev.amount += amount;
          prev.usd += usd;
        } else {
          buckets.set(key, { key, chain: chainName, symbol, amount, price, usd, change24h: change });
        }
      };

      for (const t of targets) {
        if (!t.addresses.length) continue;
        const tokenList: WalletToken[] = await fetchWalletTokens(t.walletKey, t.addresses);
        for (const tk of tokenList) {
          add(tk.chain, tk.symbol, tk.amount, tk.price, 0, tk.chainName);
        }
        const balances = await Promise.all(
          t.addresses.map((a) => fetchBalance(a.chain, a.address, t.walletKey) as Promise<Balance | null>),
        );
        for (const b of balances) {
          if (!b) continue;
          const sym = PRICE_SYMBOL[b.chain] ?? b.symbol.toLowerCase();
          const quote = priceBySymbol.get(sym);
          add(b.chain, b.symbol, b.amount, quote?.price ?? 0, quote?.change ?? 0, b.chain);
        }
      }

      if (!cancelled) {
        setHoldings(
          Array.from(buckets.values())
            .filter((h) => h.usd > 0)
            .sort((a, b) => b.usd - a.usd),
        );
      }
    };

    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [targets, priceBySymbol]);

  if (!session) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <Wallet className="mb-3 h-8 w-8 text-primary" />
        <h1 className="font-display text-xl font-semibold">Portfolio</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with a wallet to see your combined holdings.
        </p>
        <Link
          to="/wallet"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Get started <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  const total = (holdings ?? []).reduce((s, h) => s + h.usd, 0);
  const pnl = (holdings ?? []).reduce((s, h) => {
    const factor = 1 + h.change24h / 100;
    if (factor <= 0) return s;
    return s + (h.usd - h.usd / factor);
  }, 0);
  const pnlPct = total - pnl > 0 ? (pnl / (total - pnl)) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
        <PieChart className="h-5 w-5 text-primary" /> Portfolio
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Combined value across {accounts.length} account{accounts.length === 1 ? "" : "s"} on this
        device.
      </p>

      {holdings === null && (
        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading holdings…
        </div>
      )}

      {holdings !== null && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="glass rounded-xl p-4 sm:col-span-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Total value
              </p>
              <p className="mt-1 font-display text-3xl font-semibold">{formatUSD(total)}</p>
              <p
                className={
                  "mt-1 flex items-center gap-1 text-xs " +
                  (pnl >= 0 ? "text-emerald-500" : "text-red-500")
                }
              >
                {pnl >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {pnl >= 0 ? "+" : ""}
                {formatUSD(pnl)} ({pnl >= 0 ? "+" : ""}
                {pnlPct.toFixed(2)}%) · 24h
              </p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Assets</p>
              <p className="mt-1 font-display text-3xl font-semibold">{holdings.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">funded positions</p>
            </div>
          </div>

          {holdings.length === 0 ? (
            <p className="mt-8 rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No funded assets yet. Deposit crypto to your wallet and it will appear here.
            </p>
          ) : (
            <>
              <div className="mt-4 glass rounded-xl p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Allocation
                </p>
                <AllocationDonut holdings={holdings} />
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
                <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_0.8fr] gap-3 border-b border-border px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground sm:grid">
                  <span>Asset</span>
                  <span className="text-right">Amount</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Value</span>
                  <span className="text-right">24h</span>
                </div>
                {holdings.map((h) => (
                  <div
                    key={h.key}
                    className="grid grid-cols-2 gap-2 border-b border-border/60 px-4 py-3 last:border-0 sm:grid-cols-[1.4fr_1fr_1fr_1fr_0.8fr] sm:items-center sm:gap-3"
                  >
                    <span className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
                      <span className="block h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {h.symbol}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {h.chain}
                        </span>
                      </span>
                    </span>
                    <span className="text-right text-xs text-foreground sm:text-sm">
                      <span className="mr-1 text-[10px] uppercase text-muted-foreground sm:hidden">
                        Amt{" "}
                      </span>
                      {h.amount.toFixed(6)}
                    </span>
                    <span className="text-right text-xs text-muted-foreground sm:text-sm">
                      <span className="mr-1 text-[10px] uppercase sm:hidden">Price </span>
                      {formatUSD(h.price)}
                    </span>
                    <span className="text-right text-sm font-semibold text-foreground">
                      <span className="mr-1 text-[10px] uppercase text-muted-foreground sm:hidden">
                        Val{" "}
                      </span>
                      {formatUSD(h.usd)}
                    </span>
                    <span
                      className={
                        "text-right text-xs font-medium " +
                        (h.change24h >= 0 ? "text-emerald-500" : "text-red-500")
                      }
                    >
                      {h.change24h >= 0 ? "+" : ""}
                      {h.change24h.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

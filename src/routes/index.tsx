import { PartnersSection } from "@/components/PartnersSection";
import homeFinance from "@/assets/home-finance.jpg";
import { Button } from "@/components/ui/button";
import { brandPreviewMeta } from "@/lib/brand";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, Lock, Rocket, ShieldCheck, Sparkles, Wallet2, Zap } from "lucide-react";
import { ChangeBadge } from "@/components/ChangeBadge";
import { MarketTicker } from "@/components/MarketTicker";
import { Sparkline } from "@/components/Sparkline";
import { CopyButton } from "@/components/CopyButton";
import { marketsQuery, formatUSD, formatCompact, formatPct } from "@/lib/prices";
import { fetchBalance, type Balance } from "@/lib/balances";
import { useWalletSession } from "@/hooks/useWalletSession";
import { cn } from "@/lib/utils";
import { getDisplayBalances } from "@/lib/admin.functions";
import { useYieldDisplay } from "@/hooks/useYieldDisplay";
import { readWithdraw } from "@/lib/withdraw";
import { readInvestmentPlan } from "@/lib/investment-plan-balance";
import { readDisplayFlags } from "@/lib/display-flags";
import { YieldEligibleNote } from "@/components/YieldEligibleNote";
import { fetchWalletTokens, type WalletToken } from "@/lib/tokens";
import { Brand } from "@/components/BrandText";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      ...brandPreviewMeta,
      { title: "PrimeCapital | Crypto Markets & Self-Custody Wallets" },
      { name: "description", content: "Explore live crypto markets, trading tools, and self-custody wallets with PrimeCapital." },
      { property: "og:title", content: "PrimeCapital | Crypto Markets & Self-Custody Wallets" },
      { property: "og:description", content: "Explore live crypto markets, trading tools, and self-custody wallets with PrimeCapital." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="home-terminal">
      <Hero />
      <MarketTicker />
      <HeroPreview />
      <HomeWalletBalances />
      <TrendingSection />
      <FeatureGrid />
      <StatsBand />
      <PartnersSection />
      <CTASection />
    </div>
  );
}

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
};

interface DisplayOverrides {
  usd_balance: number | null;
  yield_balance: number;
  live_balance_frozen: boolean;
  frozen_live_balance: number | null;
  mock_live_balance: number;
  token_overrides: Record<string, number>;
}

function HomeWalletBalances() {
  const session = useWalletSession();
  const addresses = session?.wallet?.addresses ?? [];
  const walletKey = session?.address ?? "";
  const { data: markets } = useQuery(marketsQuery(100));
  const getDisplay = useServerFn(getDisplayBalances);
  const [balances, setBalances] = useState<Record<string, Balance | "loading">>({});
  const [display, setDisplay] = useState<DisplayOverrides | null>(null);
  const [tokens, setTokens] = useState<WalletToken[]>([]);

  useEffect(() => {
    if (!walletKey || addresses.length === 0) return;
    let cancelled = false;
    fetchWalletTokens(walletKey, addresses).then((t) => { if (!cancelled) setTokens(t); });
    return () => { cancelled = true; };
  }, [addresses, walletKey]);

  useEffect(() => {
    if (addresses.length === 0) return;
    let cancelled = false;
    setBalances(Object.fromEntries(addresses.map((a) => [a.chain, "loading"])));
    addresses.forEach((a) => {
      fetchBalance(a.chain, a.address, walletKey).then((balance) => {
        if (!cancelled) setBalances((prev) => ({ ...prev, [a.chain]: balance }));
      });
    });
    return () => { cancelled = true; };
  }, [addresses, walletKey]);

  useEffect(() => {
    if (!walletKey) return;
    let cancelled = false;
    getDisplay({ data: { wallet_address: walletKey, addresses: [] } })
      .then((r) => {
        if (!cancelled) setDisplay(r.overrides);
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [getDisplay, walletKey]);

  const priceBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    for (const coin of markets ?? []) map.set(coin.symbol.toLowerCase(), coin.current_price);
    // Polygon rebranded MATIC -> POL on CoinGecko; keep both keys resolvable.
    const pol = map.get("pol") ?? map.get("matic");
    if (pol != null) { map.set("pol", pol); map.set("matic", pol); }
    return map;
  }, [markets]);

  const rows = addresses.map((address) => {
    const balance = balances[address.chain];
    const amount = balance && balance !== "loading" ? balance.amount : null;
    const symbol = balance && balance !== "loading" ? balance.symbol : address.chain.replace("BTC_LEGACY", "BTC");
    const price = priceBySymbol.get(PRICE_SYMBOL[address.chain] ?? symbol.toLowerCase()) ?? 0;
    const usd = amount == null ? null : amount * price;
    return { address, amount, symbol, usd, loading: balance === "loading" || balance === undefined };
  });
  const tokensUsd = tokens.reduce((sum, t) => sum + (t.usd ?? 0), 0);
  const realTotal = rows.reduce((sum, row) => sum + (row.usd ?? 0), 0) + tokensUsd;
  const initialBalance = display?.live_balance_frozen && display.frozen_live_balance != null
    ? display.frozen_live_balance
    : realTotal + (display?.mock_live_balance ?? 0);
  const animatedYield = useYieldDisplay(display?.yield_balance ?? 0);
  const invested = readInvestmentPlan(display?.token_overrides).principal;
  const total = Math.max(0, initialBalance + animatedYield.value - invested);
  const flags = readDisplayFlags(display?.token_overrides);

  if (!session?.wallet || addresses.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10">
      <div className="glass-strong rounded-2xl p-5 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-primary/90 font-medium">Total balance</p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-semibold break-words">{formatUSD(total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
          </div>
          <p className="min-w-0 text-sm text-muted-foreground break-words md:text-right">
            {session.wallet.label} · <span className="font-semibold text-foreground">{session.username}</span>
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <BalanceStat
            title="Initial balance"
            value={initialBalance}
            caption={display?.live_balance_frozen ? "Frozen display" : ""}
            changePct={flags.change24hEnabled ? flags.change24hPct : null}
          />
          <BalanceStat
            title="Yield"
            value={animatedYield.value}
            caption={`${animatedYield.pct >= 0 ? "+" : ""}${animatedYield.pct.toFixed(2)}%`}
            tone={animatedYield.pct >= 0 ? "up" : "down"}
            totalPct={initialBalance > 0 ? (animatedYield.value / initialBalance) * 100 : 0}
            showYieldEligible={flags.yieldEligible}
          />
          <BalanceStat title="Combined total" value={total} caption={invested > 0 ? "Initial + yield − plans" : "Initial + yield"} />
        </div>
        <WithdrawCta
          tokens={display?.token_overrides}
          username={session.username}
          yieldValue={animatedYield.value}
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((row) => (
            <div key={row.address.chain} className="glass min-w-0 overflow-hidden rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{row.address.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{row.symbol}</p>
                </div>
                <p className="shrink-0 font-mono text-sm text-right">
                  {row.loading ? "Loading" : `${(row.amount ?? 0).toFixed(6)}`}
                </p>
              </div>
              <div className="mt-3 flex min-w-0 items-center gap-2">
                <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{row.address.address}</p>
                <span className="shrink-0"><CopyButton value={row.address.address} label="" /></span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{row.usd == null ? "$—" : formatUSD(row.usd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WithdrawCta({
  tokens,
  username,
  yieldValue,
}: {
  tokens?: Record<string, number>;
  username?: string | null;
  yieldValue: number;
}) {
  const { button } = readWithdraw(tokens);
  const [open, setOpen] = useState(false);
  if (button === "none") return null;

  const name = username || "User";
  void yieldValue;

  if (button === "green" || button === "red") {
    const linkClass =
      button === "green"
        ? "inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:opacity-90"
        : "inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:opacity-90";
    return (
      <div className="mt-5 flex justify-center">
        <Link
          to="/withdraw"
          className={linkClass}
        >
          <Wallet2 className="h-4 w-4" /> Withdraw
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 flex justify-center">
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:opacity-90",
          "bg-blue-600",
        )}
      >
        <Wallet2 className="h-4 w-4" /> Withdraw yield
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass-strong w-full max-w-md rounded-2xl p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl font-semibold">Withdrawal eligibility</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{name}</span> is not eligible to
              withdraw yield at this time.
            </p>
            <button
              onClick={() => setOpen(false)}
              className="mt-6 w-full rounded-lg glass px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function BalanceStat({ title, value, caption, tone, totalPct, changePct, showYieldEligible }: { title: string; value: number; caption: string; tone?: "up" | "down"; totalPct?: number; changePct?: number | null; showYieldEligible?: boolean }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</p>
        {changePct != null && <ChangeBadge pct={changePct} />}
      </div>
      <p className="mt-1 font-display text-xl font-semibold">{formatUSD(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      <div className="mt-1 flex items-center gap-2 flex-wrap">
        <span className={cn("text-xs text-muted-foreground", tone === "up" && "text-success", tone === "down" && "text-destructive")}>{caption}</span>
        {totalPct !== undefined && (
          <span className={cn("text-[10px] font-mono rounded px-1.5 py-0.5", totalPct >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
            Total {totalPct >= 0 ? "+" : ""}{totalPct.toFixed(2)}%
          </span>
        )}
      </div>
      {showYieldEligible && <YieldEligibleNote />}
    </div>
  );
}


function Hero() {
  return (
    <section className="home-hero relative isolate overflow-hidden border-b border-border bg-background">
      <img src={homeFinance} alt="" width={1920} height={1024} fetchPriority="high" className="home-hero-image pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="home-hero-copy max-w-2xl py-12 sm:py-16 lg:py-12 sm:py-16">
          <div className="flex items-center gap-3 text-xs font-mono text-primary"><span className="h-px w-8 bg-primary" /> MARKETS. WALLET. EXCHANGE.</div>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight sm:text-6xl"><Brand /><span className="mt-2 block text-primary">Your next move.</span></h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">A sharper view of crypto. Explore the markets, open your trading terminal, and keep your wallet within reach.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/trade">Launch Terminal <ArrowUpRight /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/wallet"><Wallet2 /> Create a Wallet</Link></Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Market intelligence</span>
            <span className="inline-flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /> Browser-native wallets</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border py-4 text-xs">
          <span className="font-mono text-muted-foreground">THE MARKET DOESN’T WAIT.</span>
          <Link to="/markets" className="inline-flex items-center gap-2 text-primary">Explore markets <ArrowUpRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </section>
  );
}

function HeroPreview() {
  const { data, isPending, isError, refetch } = useQuery(marketsQuery(5));
  const coins = data ?? [];
  const primary = coins[0];
  return (
    <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-mono text-primary">01 / MARKET SNAPSHOT</p><h2 className="mt-2 text-2xl font-semibold sm:text-3xl">An edge in every direction.</h2></div>
        <Button asChild variant="outline" size="sm"><Link to="/trade">Open terminal <ArrowUpRight /></Link></Button>
      </div>
      <div className="grid border-y border-border lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative min-w-0 bg-surface py-6">
          {primary ? <>
            <div className="flex flex-wrap items-start justify-between gap-5 px-5 sm:px-7">
              <div><div className="flex items-center gap-2"><img src={primary.image} alt="" width={28} height={28} className="h-7 w-7" /><span className="text-sm font-medium">{primary.name} <span className="font-mono text-muted-foreground">/ USDT</span></span></div><p className="mt-4 font-mono text-3xl font-semibold sm:text-4xl">{formatUSD(primary.current_price)}</p><div className="mt-2 flex items-center gap-2"><ChangeBadge pct={primary.price_change_percentage_24h} /><span className="text-xs text-muted-foreground">past 24 hours</span></div></div>
              <div className="text-right text-xs text-muted-foreground"><p className="font-mono">7D PRICE HISTORY</p><p className="mt-3">Volume <span className="ml-2 font-mono text-foreground">${formatCompact(primary.total_volume)}</span></p><p className="mt-2">Market cap <span className="ml-2 font-mono text-foreground">${formatCompact(primary.market_cap)}</span></p></div>
            </div>
            <div className="mt-6 overflow-hidden"><Sparkline data={primary.sparkline_in_7d?.price ?? []} up={primary.price_change_percentage_24h >= 0} width={800} height={125} className="h-32 w-full" /></div>
            <div className="mt-4 flex justify-between px-5 font-mono text-[10px] text-muted-foreground sm:px-7"><span>7 DAYS AGO</span><span>LATEST</span></div>
          </> : <div className="flex min-h-72 items-center justify-center gap-3 text-sm text-muted-foreground">{isError ? <>Market data unavailable <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></> : "Loading market data…"}</div>}
        </div>
        <div className="min-w-0 border-t border-border bg-background lg:border-l lg:border-t-0">
          <div className="flex justify-between border-b border-border px-5 py-4 text-[10px] font-mono text-muted-foreground"><span>LEADING ASSETS</span><span>PRICE / 24H</span></div>
          {coins.map(c => <Link key={c.id} to="/trade" className="flex items-center gap-3 border-b border-border/60 px-5 py-4 transition-colors last:border-0 hover:bg-accent">
            <img src={c.image} alt="" width={30} height={30} className="h-8 w-8 rounded-full" />
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{c.symbol.toUpperCase()}</p><p className="truncate text-xs text-muted-foreground">{c.name}</p></div>
            <div className="text-right font-mono"><p className="text-sm">{formatUSD(c.current_price)}</p><p className={cn("mt-1 text-xs", c.price_change_percentage_24h >= 0 ? "text-success" : "text-destructive")}>{formatPct(c.price_change_percentage_24h)}</p></div>
          </Link>)}
          {isPending && <div className="p-5 text-sm text-muted-foreground">Loading leading assets…</div>}
        </div>
      </div>
    </section>
  );
}

function TrendingSection() {
  const { data, isLoading } = useQuery(marketsQuery(8));
  const coins = data ?? [];
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary/90 font-medium">02 / MARKET WATCH</p>
          <h2 className="mt-2 font-display text-3xl md:text-4xl font-semibold">The market at a glance</h2>
        </div>
        <Link to="/markets" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          All markets <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(isLoading ? Array.from({ length: 8 }) : coins).map((c: any, i) => (
          <TrendingCard key={c?.id ?? i} coin={c} />
        ))}
      </div>
    </section>
  );
}

function TrendingCard({ coin }: { coin: any }) {
  if (!coin) {
    return <div className="border border-border bg-surface rounded-lg h-40 animate-pulse" />;
  }
  const up = coin.price_change_percentage_24h >= 0;
  return (
    <Link
      to="/trade"
      className="group border border-border bg-surface rounded-lg p-4 hover:border-primary/50 hover:bg-card transition-all relative overflow-hidden"
    >
      <div className="flex items-center gap-3">
        <img src={coin.image} alt="" className="h-8 w-8 rounded-full" />
        <div>
          <p className="text-sm font-semibold">{coin.symbol.toUpperCase()}</p>
          <p className="text-xs text-muted-foreground">{coin.name}</p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <p className="font-display text-xl font-semibold">{formatUSD(coin.current_price)}</p>
        <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded", up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
          {formatPct(coin.price_change_percentage_24h)}
        </span>
      </div>
      <div className="mt-3 -mx-4 -mb-4">
        <Sparkline data={coin.sparkline_in_7d?.price ?? []} up={up} width={280} height={56} className="w-full h-14" />
      </div>
    </Link>
  );
}

const FEATURES = [
  {
    icon: BarChart3,
    title: "Pro trading terminal",
    body: "Full TradingView charts, 50+ indicators, drawing tools, and multiple timeframes.",
  },
  {
    icon: Wallet2,
    title: "Browser-native HD wallets",
    body: "BIP39 mnemonics, BIP32/44/84 derivation for BTC, ETH, and every EVM chain.",
  },
  {
    icon: Lock,
    title: "Non-custodial by default",
    body: "Keys are encrypted with AES and stored only in your browser. Ever.",
  },
  {
    icon: Rocket,
    title: "Real-time everywhere",
    body: "Live prices, live order books, live sparklines. Updated every second.",
  },
  {
    icon: ShieldCheck,
    title: "Institutional security",
    body: "2FA-ready, device tracking, anti-phishing codes and withdrawal whitelists.",
  },
  {
    icon: Sparkles,
    title: "Zero clutter",
    body: "A design tuned for hours of screen time. Bloomberg density, Apple polish.",
  },
];

function FeatureGrid() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-widest text-primary/90 font-medium">03 / THE PRIMECAPITAL EDGE</p>
        <h2 className="mt-2 font-display text-3xl md:text-4xl font-semibold">
          Everything a trader needs.
          <br />
          Nothing they don't.
        </h2>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="border-t border-border py-6 transition group">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-primary">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatsBand() {
  const { data } = useQuery(marketsQuery(100));
  const coins = data ?? [];
  const stats = [
    { label: "Assets in market feed", value: data ? String(coins.length) : "—" },
    { label: "Advancing · past 24h", value: data ? String(coins.filter(coin => coin.price_change_percentage_24h > 0).length) : "—" },
    { label: "Declining · past 24h", value: data ? String(coins.filter(coin => coin.price_change_percentage_24h < 0).length) : "—" },
  ];
  return <section className="border-y border-border bg-surface"><div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">{stats.map(stat => <div key={stat.label}><p className="font-mono text-2xl font-semibold">{stat.value}</p><p className="mt-2 text-xs text-muted-foreground">{stat.label}</p></div>)}</div></section>;
}

function CTASection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
        <div><div className="mb-4 flex items-center gap-2 text-xs font-mono text-primary"><Zap className="h-4 w-4" /> YOUR NEXT CHAPTER</div><h2 className="text-3xl font-semibold sm:text-4xl">Ready when you are.</h2><p className="mt-3 max-w-lg text-muted-foreground">Your markets. Your wallet. All in one place.</p></div>
        <div className="flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/wallet">Create a wallet <ArrowUpRight /></Link></Button><Button asChild size="lg" variant="outline"><Link to="/markets">Explore markets</Link></Button></div>
      </div>
    </section>
  );
}

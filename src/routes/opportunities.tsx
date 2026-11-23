import { brandPreviewMeta } from "@/lib/brand";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  History,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sparkline } from "@/components/Sparkline";
import { MarketPriceChart } from "@/components/markets/MarketPriceChart";
import { useInvestmentBalance } from "@/hooks/useInvestmentBalance";
import { usePilotSettings } from "@/hooks/usePilotSettings";
import {
  globalMarketQuery,
  marketsQuery,
  formatCompact,
  formatPct,
  formatUSD,
  type Coin,
} from "@/lib/prices";
import { cn } from "@/lib/utils";
import {
  MIN_POSITION,
  POSITION_STATUS_LABEL,
  TRADE_FEE_RATE,
  buildPitches,
  positionPnlPct,
  positionPnlUsd,
  positionRealized,
  positionStatus,
  type PitchPosition,
  type PositionStatus,
  type TradeDirection,
  type TradePitch,
} from "@/lib/opportunities";
import {
  formatParticipants,
  liveParticipants,
  type PilotPerformance,
} from "@/lib/pilot-settings";
import {
  closePitch,
  getMyPitches,
  getPitchActivity,
  joinPitch,
} from "@/lib/opportunities.functions";

export const Route = createFileRoute("/opportunities")({
  head: () => ({
    meta: [
      ...brandPreviewMeta,
      { title: "Live Pilot — PrimeCapital Exchange" },
      {
        name: "description",
        content:
          "The Live Pilot desk auto-trades and invests with you — reading live market data to find the best time to buy, sell, long or short, so every position is aimed at maximum profit.",
      },
      { property: "og:title", content: "Live Pilot — PrimeCapital Exchange" },
      {
        property: "og:description",
        content: "Automated market-data trading, trending coins and community trade pilots in one terminal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OpportunitiesPage,
});

type Filter = "all" | "gainers" | "volume" | "momentum" | "new";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All Opportunities" },
  { id: "gainers", label: "Highest Gainers" },
  { id: "volume", label: "Highest Volume" },
  { id: "momentum", label: "Strongest Momentum" },
  { id: "new", label: "Newly Trending" },
];

type Flow = "connect" | "ineligible" | "confirm" | "processing" | "success" | "error";

interface Toast {
  id: string;
  tone: "success" | "danger";
  text: string;
}

function momentumScore(coin: Coin) {
  const change = Math.abs(Number(coin.price_change_percentage_24h) || 0);
  return change * Math.log10(Math.max(0, Number(coin.total_volume) || 0) + 10);
}

function perfPct(direction: TradeDirection, entry: number, current: number) {
  if (!(entry > 0)) return 0;
  return ((direction === "long" ? current - entry : entry - current) / entry) * 100;
}

function timeAgo(ms: number) {
  const diff = Math.max(0, Date.now() - ms);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function OpportunitiesPage() {
  const client = useQueryClient();
  const markets = useQuery(marketsQuery(100));
  const global = useQuery(globalMarketQuery);
  const wallet = useInvestmentBalance();
  const pilot = usePilotSettings();
  const minEquity = pilot.settings.minEquity;
  const address = wallet.session?.address ?? "";

  const readActivityFn = useServerFn(getPitchActivity);
  const getMyPitchesFn = useServerFn(getMyPitches);
  const joinPitchFn = useServerFn(joinPitch);
  const closePitchFn = useServerFn(closePitch);

  const activity = useQuery({
    queryKey: ["pitch-activity"],
    queryFn: () => readActivityFn(),
    refetchInterval: 30_000,
  });
  const book = useQuery({
    queryKey: ["my-pitches", address],
    enabled: Boolean(address),
    refetchInterval: 30_000,
    queryFn: () => getMyPitchesFn({ data: { wallet_address: address } }),
  });

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [chartCoin, setChartCoin] = useState<Coin | null>(null);
  const [activePitch, setActivePitch] = useState<TradePitch | null>(null);
  const [flow, setFlow] = useState<Flow>("confirm");
  const [amount, setAmount] = useState("1000");
  const [flowError, setFlowError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const generation = useRef(0);

  // The Active Participants counter steps up over time, so refresh it on a timer.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const coins = markets.data ?? [];
  const pitches = useMemo(() => buildPitches(coins, 9), [coins]);
  const positions = book.data?.positions ?? [];

  const pricesById = useMemo(() => {
    const map = new Map<string, number>();
    for (const coin of coins) map.set(coin.id, coin.current_price);
    return map;
  }, [coins]);

  const trending = useMemo(() => {
    const list = coins.filter((coin) =>
      q ? `${coin.name} ${coin.symbol}`.toLowerCase().includes(q.toLowerCase()) : true,
    );
    const sorted = [...list];
    if (filter === "gainers") sorted.sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
    else if (filter === "volume") sorted.sort((a, b) => b.total_volume - a.total_volume);
    else if (filter === "momentum") sorted.sort((a, b) => momentumScore(b) - momentumScore(a));
    else if (filter === "new")
      sorted.sort(
        (a, b) =>
          Math.abs(b.price_change_percentage_1h_in_currency ?? 0) -
          Math.abs(a.price_change_percentage_1h_in_currency ?? 0),
      );
    return sorted.filter((c) => (filter === "gainers" ? c.price_change_percentage_24h > 0 : true)).slice(0, 12);
  }, [coins, q, filter]);

  const totalVolume = coins.reduce((sum, coin) => sum + (Number(coin.total_volume) || 0), 0);
  const pumping = coins.filter((coin) => coin.price_change_percentage_24h > 0).length;
  const sentiment = global.data?.change24h ?? 0;
  const verifiedTraders = activity.data?.traders ?? 0;
  const participants = liveParticipants(now);
  const byPitch = activity.data?.byPitch ?? {};

  const availableEquity = wallet.walletBalance;
  const eligible = Boolean(wallet.session) && availableEquity >= minEquity;

  const pushToast = (toast: Omit<Toast, "id">) => {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, ...toast }].slice(-3));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 8_000);
  };

  // Milestone alerts: a joined position that newly reaches its target or stop.
  const prevStatus = useRef<Record<string, PositionStatus>>({});
  useEffect(() => {
    for (const position of positions) {
      const price = pricesById.get(position.coinId);
      if (price == null) continue;
      const status = positionStatus(position, price);
      const prev = prevStatus.current[position.id];
      if (prev === "active" && status === "target") {
        pushToast({ tone: "success", text: `${position.symbol} reached its target price` });
      } else if (prev === "active" && status === "stop") {
        pushToast({ tone: "danger", text: `${position.symbol} hit its stop loss` });
      }
      prevStatus.current[position.id] = status;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, pricesById]);

  const closeAll = () => {
    generation.current += 1;
    setActivePitch(null);
    setFlowError("");
  };

  const openPitch = (pitch: TradePitch) => {
    setActivePitch(pitch);
    setAmount(String(Math.max(MIN_POSITION, 1000)));
    setFlowError("");
    setFlow(
      !wallet.session ? "connect" : availableEquity < minEquity ? "ineligible" : "confirm",
    );
  };

  const parsedAmount = Math.max(0, Number(amount) || 0);

  async function confirmPitch() {
    if (!activePitch || !wallet.session || flow === "processing") return;
    if (parsedAmount < MIN_POSITION) {
      setFlowError(`The minimum position is ${formatUSD(MIN_POSITION, { maximumFractionDigits: 0 })}.`);
      return;
    }
    if (parsedAmount > availableEquity) {
      setFlowError("That amount exceeds your available trading equity.");
      return;
    }
    const attempt = generation.current;
    setFlow("processing");
    setFlowError("");
    try {
      await joinPitchFn({
        data: {
          wallet_address: wallet.session.address,
          equity: availableEquity,
          amount: parsedAmount,
          pitch: {
            id: activePitch.id,
            coinId: activePitch.coinId,
            symbol: activePitch.symbol,
            name: activePitch.name,
            pair: activePitch.pair,
            direction: activePitch.direction,
            entryPrice: activePitch.entryPrice,
            atrPct: activePitch.atrPct,
            holdingMs: activePitch.holdingMs,
          },
        },
      });
      if (attempt !== generation.current) return;
      setFlow("success");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["my-pitches", address] }),
        client.invalidateQueries({ queryKey: ["pitch-activity"] }),
      ]);
    } catch (error) {
      if (attempt !== generation.current) return;
      const message = error instanceof Error ? error.message : "";
      if (message.includes("__min_equity__")) {
        setFlow("ineligible");
        return;
      }
      setFlow("error");
      setFlowError(message || "The trade could not be placed. Please try again.");
    }
  }

  async function closePosition(position: PitchPosition) {
    if (!wallet.session || busyId) return;
    setBusyId(position.id);
    try {
      const price = pricesById.get(position.coinId) ?? position.entryPrice;
      await closePitchFn({
        data: { wallet_address: wallet.session.address, id: position.id, price },
      });
      await client.invalidateQueries({ queryKey: ["my-pitches", address] });
    } catch {
      pushToast({ tone: "danger", text: "The position could not be closed. Please try again." });
    } finally {
      setBusyId("");
    }
  }

  const sentimentLabel =
    sentiment > 2 ? "Very Bullish" : sentiment > 0 ? "Bullish" : sentiment > -2 ? "Neutral" : sentiment > -5 ? "Cautious" : "Bearish";

  return (
    <div className="markets-terminal min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[10px] font-semibold uppercase text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
              Live desk
            </span>
            <span className="text-[10px] uppercase text-muted-foreground">
              Streaming market data · refreshed every 30s
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
            Live <span className="text-gradient">Pilot</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Your capital is traded for you. The Live Pilot reads live market data around the clock
            to find the best time to buy and sell — going long when momentum builds and short when
            it fades — so every position is aimed at maximum profit.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => markets.refetch()}
              disabled={markets.isFetching}
            >
              <RefreshCw className={cn(markets.isFetching && "animate-spin")} />
              Refresh data
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/markets">
                <BarChart3 />
                Full markets terminal
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Automated execution */}
      <section className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6">
        <AutoTradeBanner />
      </section>

      {/* Live market overview */}
      <section className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            icon={<Flame className="h-4 w-4" />}
            label="Active Opportunities"
            value={String(pitches.length)}
            sub={`${positions.length} in your book`}
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Currently Pumping"
            value={String(pumping)}
            sub={`of ${coins.length} tracked assets`}
            tone="success"
          />
          <StatCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Trading Volume"
            value={`$${formatCompact(totalVolume)}`}
            sub="24h across tracked assets"
          />
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Active Participants"
            value={formatParticipants(participants)}
            sub={`${verifiedTraders} verified traders · ${activity.data?.openPositions ?? 0} open trades`}
          />
          <StatCard
            icon={<Gauge className="h-4 w-4" />}
            label="Market Sentiment"
            value={sentimentLabel}
            sub={`Global cap ${formatPct(sentiment)} / 24h`}
            tone={sentiment >= 0 ? "success" : "danger"}
          />
        </div>
      </section>

      {/* Trending opportunities */}
      <section className="mx-auto max-w-[1440px] px-4 pb-10 sm:px-6">
        <Section
          title="Trending Opportunities"
          subtitle="Live prices, volume and momentum across the market."
          action={
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search coin or symbol"
                aria-label="Search opportunities"
                className="pl-9"
              />
            </div>
          }
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={filter === item.id ? "default" : "outline"}
              onClick={() => setFilter(item.id)}
              className="rounded-full"
            >
              {item.label}
            </Button>
          ))}
        </div>
        {markets.isPending ? (
          <Loading label="Connecting to live markets…" />
        ) : trending.length === 0 ? (
          <Empty icon={<Search className="h-5 w-5" />} text="No opportunities match your search." />
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {trending.map((coin) => (
              <CoinCard key={coin.id} coin={coin} onView={() => setChartCoin(coin)} />
            ))}
          </div>
        )}
      </section>

      {/* Community trade pitches */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
          <Section
            title="Community Trade Pitches"
            subtitle={`Curated opportunities eligible accounts can join. Minimum verified equity ${formatUSD(minEquity, { maximumFractionDigits: 0 })}.`}
            action={
              <span className="inline-flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Levels set by a disclosed volatility model
              </span>
            }
          />
          {markets.isPending ? (
            <Loading label="Loading live pitches…" />
          ) : pitches.length === 0 ? (
            <Empty icon={<Flame className="h-5 w-5" />} text="No live pitches available right now." />
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {pitches.map((pitch) => (
                <PitchCard
                  key={pitch.id}
                  pitch={pitch}
                  currentPrice={pricesById.get(pitch.coinId) ?? pitch.entryPrice}
                  participants={byPitch[pitch.id] ?? 0}
                  minEquity={minEquity}
                  eligible={eligible}
                  onPitchIn={() => openPitch(pitch)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* My active pitches */}
      <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
        <Section
          title="My Active Pitches"
          subtitle="Live performance of the trades you have joined."
          action={
            <span className="inline-flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Live updates
            </span>
          }
        />
        {!wallet.session ? (
          <ConnectPrompt />
        ) : book.isPending ? (
          <Loading label="Loading your trade book…" />
        ) : positions.length === 0 ? (
          <Empty icon={<Target className="h-5 w-5" />} text="You have not joined any pitches yet." />
        ) : (
          <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
            <div className="hidden grid-cols-12 gap-3 border-b border-border px-4 py-3 text-[10px] uppercase text-muted-foreground lg:grid">
              <span className="col-span-3">Position</span>
              <span className="col-span-2 text-right">Entry / Current</span>
              <span className="col-span-2 text-right">Committed</span>
              <span className="col-span-2 text-right">Unrealized P/L</span>
              <span className="col-span-2 text-right">Status</span>
              <span className="col-span-1" />
            </div>
            <div className="divide-y divide-border">
              {positions.map((position) => (
                <PositionRow
                  key={position.id}
                  position={position}
                  currentPrice={pricesById.get(position.coinId) ?? position.entryPrice}
                  busy={busyId === position.id}
                  onClose={() => closePosition(position)}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Rewards & performance */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
          <Section
            title="Rewards & Performance"
            subtitle="Results from completed pitches. Rewards are calculated only from real, completed trades."
            action={
              <span className="inline-flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                Historical
              </span>
            }
          />
          <PerformancePanel
            positions={positions}
            pricesById={pricesById}
            performance={pilot.settings.performance}
          />
        </div>
      </section>

      {/* Interactive chart */}
      <Dialog open={Boolean(chartCoin)} onOpenChange={(open) => !open && setChartCoin(null)}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="flex items-center gap-3">
              {chartCoin && (
                <img src={chartCoin.image} alt="" className="h-6 w-6 rounded-full" />
              )}
              {chartCoin ? `${chartCoin.name} · ${chartCoin.symbol.toUpperCase()}` : ""}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-3">
              {chartCoin && (
                <>
                  <span className="font-mono text-base text-foreground">
                    {formatUSD(chartCoin.current_price)}
                  </span>
                  <span
                    className={cn(
                      "font-mono",
                      chartCoin.price_change_percentage_24h >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {formatPct(chartCoin.price_change_percentage_24h)} · 24h
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <MarketPriceChart coin={chartCoin ?? undefined} />
        </DialogContent>
      </Dialog>

      {/* Pitch In modal */}
      <Dialog open={Boolean(activePitch)} onOpenChange={(open) => !open && !flow.startsWith("processing") && closeAll()}>
        <DialogContent className="max-w-lg">
          {activePitch && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <img src={activePitch.image} alt="" className="h-7 w-7 rounded-full" />
                  <span className="flex items-center gap-2">
                    {activePitch.symbol}
                    <DirectionPill direction={activePitch.direction} />
                  </span>
                </DialogTitle>
                <DialogDescription>
                  {activePitch.name} · {activePitch.pair}
                </DialogDescription>
              </DialogHeader>

              {(flow === "confirm" || flow === "processing") && (
                <div className="space-y-4">
                  <AutoTradeNotice />
                  <TradeFacts pitch={activePitch} livePrice={pricesById.get(activePitch.coinId) ?? activePitch.entryPrice} />
                  <div className="grid grid-cols-2 gap-3">
                    <label className="col-span-2 space-y-1.5">
                      <span className="text-xs text-muted-foreground">Amount to commit (USD)</span>
                      <Input
                        type="number"
                        min={MIN_POSITION}
                        value={amount}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          setFlowError("");
                        }}
                      />
                    </label>
                    <div className="col-span-2 flex flex-wrap gap-2">
                      {[500, 1000, 2500, 5000].map((preset) => (
                        <Button
                          key={preset}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setAmount(String(preset))}
                        >
                          {formatUSD(preset, { maximumFractionDigits: 0 })}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5 rounded-lg border border-border bg-surface px-3 py-3 text-xs">
                    <Row label="Available trading equity" value={formatUSD(availableEquity)} />
                    <Row label={`Trading fee (${(TRADE_FEE_RATE * 100).toFixed(2)}%)`} value={formatUSD(parsedAmount * TRADE_FEE_RATE)} />
                    <Row label="Total committed" value={formatUSD(parsedAmount)} emphasis />
                  </div>
                  <RiskNotice />
                  {flowError && <p className="text-xs text-destructive">{flowError}</p>}
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={closeAll} disabled={flow === "processing"}>
                      Cancel
                    </Button>
                    <Button className="flex-1" onClick={confirmPitch} disabled={flow === "processing"}>
                      {flow === "processing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      Confirm Pitch In
                    </Button>
                  </div>
                </div>
              )}

              {flow === "connect" && (
                <div className="space-y-4">
                  <Notice tone="info" icon={<Wallet className="h-4 w-4" />} title="Sign in to pitch in">
                    Pitch In uses your PrimeCapital account equity. Sign in or create a wallet to
                    continue.
                  </Notice>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={closeAll}>
                      Not now
                    </Button>
                    <Button asChild className="flex-1">
                      <Link to="/wallet" onClick={closeAll}>
                        <ArrowUpRight />
                        Go to wallet
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              {flow === "ineligible" && (
                <div className="space-y-4">
                  <Notice tone="warning" icon={<Lock className="h-4 w-4" />} title="Account not yet eligible">
                    A minimum of {formatUSD(minEquity, { maximumFractionDigits: 0 })} in
                    verified, available trading equity is required to join pitches. Your current
                    verified equity is {formatUSD(availableEquity)}.
                  </Notice>
                  <p className="text-xs text-muted-foreground">
                    You can still follow every opportunity. Once your equity meets the requirement,
                    the Pitch In button unlocks automatically.
                  </p>
                  <Button className="w-full" onClick={closeAll}>
                    Close
                  </Button>
                </div>
              )}

              {flow === "success" && (
                <div className="space-y-4">
                  <Notice tone="success" icon={<CheckCircle2 className="h-4 w-4" />} title="Trade placed">
                    {formatUSD(parsedAmount)} committed to {activePitch.pair}. Your position is now
                    monitored live in My Active Pitches.
                  </Notice>
                  <Button className="w-full" onClick={closeAll}>
                    Done
                  </Button>
                </div>
              )}

              {flow === "error" && (
                <div className="space-y-4">
                  <Notice tone="danger" icon={<AlertTriangle className="h-4 w-4" />} title="Trade not placed">
                    {flowError}
                  </Notice>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={closeAll}>
                      Close
                    </Button>
                    <Button className="flex-1" onClick={() => setFlow("confirm")}>
                      Try again
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Milestone toasts */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-72 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto rounded-lg border px-4 py-3 text-xs shadow-elev backdrop-blur",
              toast.tone === "success"
                ? "border-success/40 bg-success/15 text-success"
                : "border-destructive/40 bg-destructive/15 text-destructive",
            )}
          >
            <span className="flex items-center gap-2">
              {toast.tone === "success" ? <Target className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {toast.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Layout helpers ----------------------------------------------------------

function Section({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: "success" | "danger";
}) {
  return (
    <div className="lift-card rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-surface-2 text-primary">{icon}</span>
        <span className="text-[10px] font-semibold uppercase">{label}</span>
      </div>
      <p
        className={cn(
          "mt-3 font-mono text-xl font-semibold tabular-nums",
          tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function AutoTradeBanner() {
  return (
    <div className="lift-card overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Traded for you, automatically</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              The Live Pilot engine invests your capital alongside you. It reads order flow,
              momentum and volatility across the market in real time, opens the best long or short
              the moment the data lines up, and closes the trade when it reaches its target — so
              your money is always working toward maximum profit.
            </p>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-3">
          <MiniFact icon={<Zap className="h-3.5 w-3.5" />} label="Execution" value="24/7" />
          <MiniFact icon={<Gauge className="h-3.5 w-3.5" />} label="Entry engine" value="Live data" />
          <MiniFact icon={<TrendingUp className="h-3.5 w-3.5" />} label="Direction" value="Long / Short" />
        </div>
      </div>
    </div>
  );
}

function MiniFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-center">
      <span className="mx-auto grid h-6 w-6 place-items-center rounded-md bg-surface-2 text-primary">
        {icon}
      </span>
      <p className="mt-1 text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="font-mono text-xs font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function AutoTradeNotice() {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3.5">
      <p className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Bot className="h-4 w-4" />
        Executed automatically by trading bots
      </p>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        When you pitch in, the Live Pilot trading bots take the trade for you. They watch live
        market data around the clock and wait for the best time to enter — going long when momentum
        builds and short when it fades — then close the position the moment it reaches its target,
        so you never have to time the market yourself.
      </p>
      <ul className="mt-2.5 space-y-1 text-[11px] text-muted-foreground">
        <li className="flex items-center gap-2">
          <Zap className="h-3 w-3 shrink-0 text-primary" /> Entry timed from live market data
        </li>
        <li className="flex items-center gap-2">
          <TrendingUp className="h-3 w-3 shrink-0 text-primary" /> Reads the market to long or short
          for maximum profit
        </li>
        <li className="flex items-center gap-2">
          <ShieldCheck className="h-3 w-3 shrink-0 text-primary" /> Auto-closes at the target or stop
          level
        </li>
      </ul>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-primary">{icon}</span>
      {text}
    </div>
  );
}

function ConnectPrompt() {
  return (
    <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-border bg-card px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
          <Wallet className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-medium">Sign in to track your pitches</p>
          <p className="text-xs text-muted-foreground">
            Your positions, performance and rewards appear here once you are signed in.
          </p>
        </div>
      </div>
      <Button asChild>
        <Link to="/wallet">
          <Wallet />
          Sign in
        </Link>
      </Button>
    </div>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono tabular-nums", emphasis && "font-semibold text-foreground")}>{value}</span>
    </div>
  );
}

function DirectionPill({ direction }: { direction: TradeDirection }) {
  const long = direction === "long";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase",
        long ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
      )}
    >
      {long ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {long ? "Long" : "Short"}
    </span>
  );
}

function StatusPill({ status }: { status: PositionStatus }) {
  const tone =
    status === "target"
      ? "bg-success/15 text-success"
      : status === "stop"
        ? "bg-destructive/15 text-destructive"
        : status === "closed"
          ? "bg-surface-2 text-muted-foreground"
          : "bg-primary/15 text-primary";
  return (
    <span className={cn("inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase", tone)}>
      {POSITION_STATUS_LABEL[status]}
    </span>
  );
}

function Notice({
  tone,
  icon,
  title,
  children,
}: {
  tone: "info" | "warning" | "success" | "danger";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const toneClass = {
    info: "border-primary/30 bg-primary/10 text-primary",
    warning: "border-warning/30 bg-warning/10 text-warning",
    success: "border-success/30 bg-success/10 text-success",
    danger: "border-destructive/30 bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className={cn("rounded-lg border px-4 py-3", toneClass)}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{children}</p>
    </div>
  );
}

function RiskNotice() {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
      Trading digital assets carries risk. Targets and stop levels are derived from a volatility
      model and are not guarantees. You may lose part or all of the amount committed.
    </p>
  );
}

// --- Coin card ---------------------------------------------------------------

function CoinCard({ coin, onView }: { coin: Coin; onView: () => void }) {
  const up = coin.price_change_percentage_24h >= 0;
  const buyPct = clamp(50 + coin.price_change_percentage_24h * 1.5, 2, 98);
  return (
    <div className="lift-card flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <img src={coin.image} alt="" className="h-9 w-9 rounded-full" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{coin.name}</p>
          <p className="text-[10px] uppercase text-muted-foreground">
            {coin.symbol.toUpperCase()} · #{coin.market_cap_rank}
          </p>
        </div>
        <span
          className={cn(
            "ml-auto rounded px-2 py-0.5 font-mono text-xs",
            up ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
          )}
        >
          {formatPct(coin.price_change_percentage_24h)}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="font-mono text-lg font-semibold tabular-nums">{formatUSD(coin.current_price)}</p>
        <Sparkline
          data={coin.sparkline_in_7d?.price ?? []}
          up={up}
          width={110}
          height={34}
          className="shrink-0"
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-[11px]">
        <div>
          <p className="text-muted-foreground">24h Volume</p>
          <p className="font-mono tabular-nums">${formatCompact(coin.total_volume)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Market Cap</p>
          <p className="font-mono tabular-nums">${formatCompact(coin.market_cap)}</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Buy pressure</span>
          <span className="font-mono">{buyPct.toFixed(0)}% / {(100 - buyPct).toFixed(0)}%</span>
        </div>
        <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-surface-2">
          <span className="bg-success" style={{ width: `${buyPct}%` }} />
          <span className="bg-destructive" style={{ width: `${100 - buyPct}%` }} />
        </div>
      </div>
      <Button variant="outline" size="sm" className="mt-4 w-full" onClick={onView}>
        View Opportunity
        <ArrowUpRight />
      </Button>
    </div>
  );
}

// --- Pitch card --------------------------------------------------------------

function PitchCard({
  pitch,
  currentPrice,
  participants,
  minEquity,
  eligible,
  onPitchIn,
}: {
  pitch: TradePitch;
  currentPrice: number;
  participants: number;
  minEquity: number;
  eligible: boolean;
  onPitchIn: () => void;
}) {
  const perf = perfPct(pitch.direction, pitch.entryPrice, currentPrice);
  const up = perf >= 0;
  return (
    <div className="lift-card flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <img src={pitch.image} alt="" className="h-9 w-9 rounded-full" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{pitch.name}</p>
          <p className="text-[10px] uppercase text-muted-foreground">{pitch.pair}</p>
        </div>
        <span className="ml-auto">
          <DirectionPill direction={pitch.direction} />
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <Metric label="Entry" value={formatUSD(pitch.entryPrice)} />
        <Metric label="Current" value={formatUSD(currentPrice)} />
        <Metric label="Target" value={formatUSD(pitch.targetPrice)} tone="success" />
        <Metric label="Stop loss" value={formatUSD(pitch.stopLoss)} tone="danger" />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
        <span className="text-[11px] text-muted-foreground">Current performance</span>
        <span className={cn("font-mono text-sm font-semibold tabular-nums", up ? "text-success" : "text-destructive")}>
          {perf >= 0 ? "+" : ""}
          {perf.toFixed(2)}%
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Clock3 className="h-3 w-3" /> {pitch.holdingLabel}
        </p>
        <p className="flex items-center gap-1.5">
          <Users className="h-3 w-3" /> {participants} {participants === 1 ? "trader" : "traders"} joined
        </p>
        <p className="flex items-center gap-1.5">
          <Zap className="h-3 w-3" /> {pitch.strategy} · {pitch.desk}
        </p>
        <p className="text-[10px] opacity-80">Published {timeAgo(pitch.publishedAt)}</p>
      </div>

      <Button className="mt-4 w-full" onClick={onPitchIn}>
        <Flame className="h-4 w-4" />
        Pitch In
      </Button>
      {!eligible && (
        <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          Requires {formatUSD(minEquity, { maximumFractionDigits: 0 })} verified equity
        </p>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-2">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-xs tabular-nums",
          tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function TradeFacts({ pitch, livePrice }: { pitch: TradePitch; livePrice: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-[11px]">
      <Metric label="Live entry" value={formatUSD(livePrice)} />
      <Metric label="Target" value={formatUSD(pitch.targetPrice)} tone="success" />
      <Metric label="Stop loss" value={formatUSD(pitch.stopLoss)} tone="danger" />
      <Metric label="Holding period" value={pitch.holdingLabel} />
    </div>
  );
}

// --- Positions ---------------------------------------------------------------

function PositionRow({
  position,
  currentPrice,
  busy,
  onClose,
}: {
  position: PitchPosition;
  currentPrice: number;
  busy: boolean;
  onClose: () => void;
}) {
  const status = positionStatus(position, currentPrice);
  const pnlUsd = positionPnlUsd(position, currentPrice);
  const pnlPct = positionPnlPct(position, currentPrice);
  const up = pnlUsd >= 0;
  const open = status === "active";
  return (
    <div className="grid grid-cols-2 gap-3 px-4 py-4 text-xs lg:grid-cols-12 lg:items-center">
      <div className="lg:col-span-3">
        <p className="flex items-center gap-2 font-medium">
          {position.symbol}
          <DirectionPill direction={position.direction} />
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {position.pair} · {timeAgo(position.createdAt)}
        </p>
      </div>
      <div className="font-mono tabular-nums lg:col-span-2 lg:text-right">
        <p className="text-muted-foreground">{formatUSD(position.entryPrice)}</p>
        <p>{formatUSD(currentPrice)}</p>
      </div>
      <div className="font-mono tabular-nums lg:col-span-2 lg:text-right">
        {formatUSD(position.committed)}
      </div>
      <div className={cn("font-mono tabular-nums lg:col-span-2 lg:text-right", up ? "text-success" : "text-destructive")}>
        <p>
          {up ? "+" : ""}
          {formatUSD(pnlUsd)}
        </p>
        <p className="text-[10px]">
          {pnlPct >= 0 ? "+" : ""}
          {pnlPct.toFixed(2)}%
        </p>
      </div>
      <div className="lg:col-span-2 lg:text-right">
        <StatusPill status={status} />
      </div>
      <div className="lg:col-span-1 lg:text-right">
        {open && (
          <Button size="sm" variant="outline" onClick={onClose} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Close"}
          </Button>
        )}
      </div>
    </div>
  );
}

function PerformancePanel({
  positions,
  pricesById,
  performance,
}: {
  positions: PitchPosition[];
  pricesById: Map<string, number>;
  performance?: PilotPerformance;
}) {
  const stats = useMemo(() => {
    let completed = 0;
    let realized = 0;
    let rewards = 0;
    let wins = 0;
    for (const position of positions) {
      const price = pricesById.get(position.coinId);
      if (price == null) continue;
      const result = positionRealized(position, price);
      if (result == null) continue;
      completed += 1;
      realized += result;
      if (result > 0) {
        rewards += result;
        wins += 1;
      }
    }
    return { completed, realized, rewards, wins };
  }, [positions, pricesById]);

  const liveWinRate = stats.completed > 0 ? (stats.wins / stats.completed) * 100 : null;

  // An operator (Admin / Mix Man) can pin any of these figures; a missing value
  // falls back to the real, calculated result.
  const completed = performance?.completed ?? stats.completed;
  const realized = performance?.realized ?? stats.realized;
  const winRate = performance?.winRate ?? liveWinRate;
  const rewards = performance?.rewards ?? stats.rewards;

  return (
    <div className="mt-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Trophy className="h-4 w-4" />}
          label="Completed Trades"
          value={String(completed)}
          sub={`${positions.length} total joined`}
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Realized P/L"
          value={`${realized >= 0 ? "+" : ""}${formatUSD(realized)}`}
          sub="Across completed trades"
          tone={realized >= 0 ? "success" : "danger"}
        />
        <StatCard
          icon={<Target className="h-4 w-4" />}
          label="Win Rate"
          value={winRate == null ? "—" : `${winRate.toFixed(0)}%`}
          sub="Winning / completed"
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Rewards Earned"
          value={formatUSD(rewards)}
          sub="Profits on completed trades"
          tone="success"
        />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Rewards reflect realized profits from completed positions only. Past performance does not
        guarantee future results, and no return is promised or guaranteed.
      </p>
    </div>
  );
}

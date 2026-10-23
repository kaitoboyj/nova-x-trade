import { brandPreviewMeta } from "@/lib/brand";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useLiveMarket, type FeedStatus, type LiveBook, type LiveTrade } from "@/lib/live-market";
import { TradingViewChart } from "@/components/TradingViewChart";
import { marketsQuery, formatUSD, formatCompact, formatPct } from "@/lib/prices";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SwapWidget } from "@/components/SwapWidget";
import { useWalletSession } from "@/hooks/useWalletSession";
import { getPrivateKey } from "@/lib/wallet-signer";
import { notify } from "@/lib/notify";

export const Route = createFileRoute("/trade")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...brandPreviewMeta,
      { title: "Trade — PrimeCapital Terminal" },
      { name: "description", content: "Pro crypto trading terminal with live TradingView charts, order book, and market/limit orders." },
      { property: "og:title", content: "PrimeCapital Trading Terminal" },
      { property: "og:description", content: "Live TradingView charts and pro order entry, side-by-side." },
    ],
  }),
  component: TradePage,
});

const PAIRS = [
  { id: "bitcoin", symbol: "BTCUSDT", label: "BTC / USDT" },
  { id: "ethereum", symbol: "ETHUSDT", label: "ETH / USDT" },
  { id: "solana", symbol: "SOLUSDT", label: "SOL / USDT" },
  { id: "binancecoin", symbol: "BNBUSDT", label: "BNB / USDT" },
  { id: "ripple", symbol: "XRPUSDT", label: "XRP / USDT" },
  { id: "dogecoin", symbol: "DOGEUSDT", label: "DOGE / USDT" },
];

const INTERVALS = [
  { l: "1m", v: "1" },
  { l: "5m", v: "5" },
  { l: "15m", v: "15" },
  { l: "1H", v: "60" },
  { l: "4H", v: "240" },
  { l: "1D", v: "D" },
];

function TradePage() {
  const [pairIdx, setPairIdx] = useState(0);
  const [interval, setInterval] = useState("60");
  const [custom, setCustom] = useState<CustomToken | null>(null);
  const [quote, setQuote] = useState("USDT");
  const basePair = PAIRS[pairIdx];

  const { data } = useQuery(marketsQuery(50));
  const baseCoin = data?.find((c) => c.id === basePair.id);
  const quoteUsd = quote === "USDT" ? 1 : (data?.find((c) => c.symbol.toUpperCase() === quote)?.current_price ?? 0);
  const coin = custom
    ? {
        id: custom.contract,
        image: "",
        name: custom.name,
        current_price: quoteUsd ? custom.price / quoteUsd : 0,
        price_change_percentage_24h: custom.change24h ?? 0,
        total_volume: custom.volume24h ?? 0,
        market_cap: custom.marketCap ?? 0,
      }
    : baseCoin;
  const pair = custom
    ? { id: custom.contract, symbol: `${custom.symbol}${quote}`, label: `${custom.symbol} / ${quote}` }
    : basePair;
  const baseSym = custom ? custom.symbol : basePair.symbol.replace("USDT", "");
  const { book, trades, status } = useLiveMarket({
    symbol: custom ? null : pair.symbol,
    depth: 12,
    tradeLimit: 30,
  });

  return (
    <div className="mx-auto max-w-[1600px] px-3 sm:px-4 lg:px-6 py-6">
      <div className="grid gap-3 lg:grid-cols-[260px_1fr_320px]">
        {/* Left: pair list */}
        <aside className="glass rounded-xl p-2 h-fit lg:sticky lg:top-20 order-2 lg:order-1">
          <h3 className="px-3 pt-2 pb-1 text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Pairs
          </h3>
          <ul className="max-h-[560px] overflow-auto">
            {PAIRS.map((p, i) => {
              const c = data?.find((x) => x.id === p.id);
              const up = (c?.price_change_percentage_24h ?? 0) >= 0;
              const active = !custom && i === pairIdx;
              return (
                <li key={p.id}>
                  <button
                    onClick={() => { setPairIdx(i); setCustom(null); setQuote("USDT"); }}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition",
                      active ? "bg-white/10" : "hover:bg-white/5",
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {c && <img src={c.image} alt="" className="h-5 w-5 rounded-full" />}
                      <span className="font-medium">{p.label}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-xs font-mono">{c ? formatUSD(c.current_price) : "—"}</span>
                      <span className={cn("block text-[10px] font-mono", up ? "text-success" : "text-destructive")}>
                        {formatPct(c?.price_change_percentage_24h)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <CustomPairForm onLoaded={(t) => { setCustom(t); setQuote("USDT"); }} active={custom} />
        </aside>

        {/* Center: chart + book */}
        <section className="space-y-3 order-1 lg:order-2 min-w-0">
          <div className="glass rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                {coin?.image && <img src={coin.image} alt="" className="h-9 w-9 rounded-full" />}
                <div>
                  <p className="font-display text-lg font-semibold">{pair.label}</p>
                  <p className="text-xs text-muted-foreground">{coin?.name}</p>
                </div>
              </div>
              {coin && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  <Stat label="Last" value={custom && quote !== "USDT" ? `${fmtNum(coin.current_price)} ${quote}` : formatUSD(coin.current_price)} />
                  <Stat
                    label="24h %"
                    value={formatPct(coin.price_change_percentage_24h)}
                    tone={coin.price_change_percentage_24h >= 0 ? "up" : "down"}
                  />
                  <Stat label="24h Volume" value={"$" + formatCompact(coin.total_volume)} />
                  <Stat label="Market Cap" value={"$" + formatCompact(coin.market_cap)} />
                </div>
              )}
              <div className="flex gap-1">
                {INTERVALS.map((it) => (
                  <button
                    key={it.v}
                    onClick={() => setInterval(it.v)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md transition",
                      interval === it.v ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5",
                    )}
                  >
                    {it.l}
                  </button>
                ))}
              </div>
            </div>
            {custom && (
              <div className="mb-3 flex flex-wrap items-center gap-1 text-xs">
                <span className="text-muted-foreground mr-1">Value in:</span>
                {QUOTES.map((q) => (
                  <button key={q} onClick={() => setQuote(q)} className={cn("px-2.5 py-1 rounded-md", quote === q ? "bg-white/10" : "text-muted-foreground hover:bg-white/5")}>{q}</button>
                ))}
                <span className="ml-auto font-mono text-muted-foreground">
                  {QUOTES.map((q) => {
                    const u = q === "USDT" ? 1 : (data?.find((c) => c.symbol.toUpperCase() === q)?.current_price ?? 0);
                    return u ? `${fmtNum(custom.price / u)} ${q}` : null;
                  }).filter(Boolean).join(" · ")}
                </span>
              </div>
            )}
            {custom ? (
              <iframe
                title={`${custom.symbol} chart`}
                src={`https://dexscreener.com/${dexChain(custom.chain)}/${custom.contract}?embed=1&theme=dark&trades=0&info=0`}
                className="w-full rounded-lg border-0"
                style={{ height: 520 }}
              />
            ) : (
              <TradingViewChart symbol={`BINANCE:${pair.symbol}`} interval={interval} height={520} />
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <OrderBook
              live={book}
              basePrice={coin?.current_price ?? 0}
              quote={custom ? quote : "USDT"}
              status={status}
            />
            <RecentTrades
              live={trades}
              basePrice={coin?.current_price ?? 0}
              symbol={baseSym}
              quote={custom ? quote : "USDT"}
              status={status}
            />
          </div>
        </section>

        {/* Right: order entry */}
        <aside className="order-3 h-fit lg:sticky lg:top-20">
          <OrderPanel price={coin?.current_price ?? 0} symbol={baseSym} quote={custom ? quote : "USDT"} />
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn(
        "font-mono text-sm",
        tone === "up" && "text-success",
        tone === "down" && "text-destructive",
      )}>
        {value}
      </p>
    </div>
  );
}

function StatusDot({ status, live }: { status: FeedStatus; live: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          live ? "bg-success animate-pulse" : status === "connecting" ? "bg-amber-400 animate-pulse" : "bg-destructive",
        )}
      />
      {live ? "Live" : status === "connecting" ? "Connecting" : "Offline"}
    </span>
  );
}

function OrderBook({
  live,
  basePrice,
  quote,
  status,
}: {
  live: LiveBook | null;
  basePrice: number;
  quote: string;
  status: FeedStatus;
}) {
  const fallback = useMemo(() => generateBook(basePrice), [basePrice]);
  const rows = live ?? fallback;
  const mid = live?.mid || basePrice;
  const streaming = Boolean(live?.bids.length);
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-semibold">Order Book</h3>
        <StatusDot status={status} live={streaming} />
      </div>
      <div className="grid grid-cols-3 text-[10px] uppercase tracking-widest text-muted-foreground pb-2">
        <span>Price ({quote})</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
      </div>
      <div className="space-y-0.5">
        {rows.asks.map((r, i) => <BookRow key={"a" + i} row={r} side="ask" />)}
      </div>
      <div className="my-2 text-center py-1 rounded bg-white/5 font-mono text-sm tabular-nums">
        {quote === "USDT" ? formatUSD(mid) : `${fmtNum(mid)} ${quote}`}
      </div>
      <div className="space-y-0.5">
        {rows.bids.map((r, i) => <BookRow key={"b" + i} row={r} side="bid" />)}
      </div>
    </div>
  );
}

function BookRow({
  row,
  side,
}: {
  row: { price: number; amount: number; pct: number; total: number };
  side: "bid" | "ask";
}) {
  return (
    <div className="relative grid grid-cols-3 text-xs font-mono py-0.5 tabular-nums">
      <div
        className={cn("absolute inset-y-0 right-0 opacity-15", side === "bid" ? "bg-success" : "bg-destructive")}
        style={{ width: `${row.pct}%` }}
      />
      <span className={cn("relative", side === "bid" ? "text-success" : "text-destructive")}>
        {fmtNum(row.price)}
      </span>
      <span className="relative text-right">{row.amount.toFixed(4)}</span>
      <span className="relative text-right text-muted-foreground">{row.total.toFixed(3)}</span>
    </div>
  );
}

function generateBook(base: number): LiveBook {
  if (!base) return { bids: [], asks: [], mid: 0, updatedAt: 0 };
  const step = base * 0.0004;
  const rand = (i: number) => Math.abs(Math.sin(i * 12.9898 + base) * 43758.5) % 1;
  const askRaw = Array.from({ length: 12 }, (_, i) => ({
    price: base + step * (i + 1),
    amount: 0.2 + rand(i + 3) * 4,
  })).reverse();
  const bidRaw = Array.from({ length: 12 }, (_, i) => ({
    price: base - step * (i + 1),
    amount: 0.2 + rand(i + 9) * 4,
  }));
  const cumulative = (rows: { price: number; amount: number }[]) => {
    let cum = 0;
    return rows.map((r) => {
      cum += r.amount;
      return { ...r, total: cum, pct: 0 };
    });
  };
  const bids = cumulative(bidRaw);
  const asks = cumulative(askRaw);
  const max = Math.max(
    bids.length ? bids[bids.length - 1].total : 0,
    asks.length ? asks[asks.length - 1].total : 0,
    1e-9,
  );
  for (const l of [...bids, ...asks]) l.pct = (l.total / max) * 100;
  return { bids, asks, mid: base, updatedAt: Date.now() };
}

function RecentTrades({
  live,
  basePrice,
  symbol,
  status,
}: {
  live: LiveTrade[];
  basePrice: number;
  symbol: string;
  quote: string;
  status: FeedStatus;
}) {
  const fallback = useMemo(() => {
    if (!basePrice) return [];
    const now = Date.now();
    return Array.from({ length: 14 }, (_, i) => {
      const drift = (Math.sin(i * 3.3 + basePrice) + 1) * 0.5;
      return {
        id: `sim-${i}`,
        buy: drift > 0.45,
        price: basePrice * (1 + (drift - 0.5) * 0.0006),
        amount: 0.05 + drift * 1.4,
        at: now - i * 8000,
      };
    });
  }, [basePrice]);
  const rows = live.length ? live : fallback;
  const streaming = live.length > 0;
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-semibold">Recent Trades · {symbol}</h3>
        <StatusDot status={status} live={streaming} />
      </div>
      <div className="grid grid-cols-3 text-[10px] uppercase tracking-widest text-muted-foreground pb-2">
        <span>Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Time</span>
      </div>
      <ul className="space-y-0.5">
        {rows.map((t, i) => (
          <li
            key={t.id}
            className={cn(
              "grid grid-cols-3 text-xs font-mono tabular-nums px-1 -mx-1 rounded transition-colors",
              streaming && i === 0 && "bg-white/5",
            )}
          >
            <span className={t.buy ? "text-success" : "text-destructive"}>{fmtNum(t.price)}</span>
            <span className="text-right">{t.amount.toFixed(4)}</span>
            <span className="text-right text-muted-foreground">
              {new Date(t.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OrderPanel({ price, symbol, quote }: { price: number; symbol: string; quote: string }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [mode, setMode] = useState<"market" | "limit" | "stop">("limit");
  const [amount, setAmount] = useState("");
  const [limit, setLimit] = useState("");
  const [leverage, setLeverage] = useState(1);
  const [swapOpen, setSwapOpen] = useState(false);
  const session = useWalletSession();
  const privateKey = session ? getPrivateKey(session.address) : undefined;

  const usdBal = 25000;
  const effectivePrice = mode === "market" ? price : Number(limit) || price;
  const total = (Number(amount) || 0) * effectivePrice;
  const feePct = 0.001;
  const fee = total * feePct;

  const setPct = (pct: number) => {
    const budget = (usdBal * pct) / 100;
    const qty = effectivePrice ? budget / effectivePrice : 0;
    setAmount(qty.toFixed(6));
  };

  const handleSubmit = () => {
    notify({
      event: `trade_${side}_click`,
      label: symbol,
      extra: `mode=${mode} amount=${amount || "0"} price=${effectivePrice} total=${total.toFixed(2)} lev=${leverage}x`,
    });
    setSwapOpen(true);
  };

  return (
    <div className="glass rounded-xl p-4 space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/30 p-1">
        <button
          onClick={() => setSide("buy")}
          className={cn(
            "rounded-md py-2 text-sm font-semibold transition",
            side === "buy" ? "bg-success text-success-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Buy {symbol}
        </button>
        <button
          onClick={() => setSide("sell")}
          className={cn(
            "rounded-md py-2 text-sm font-semibold transition",
            side === "sell" ? "bg-emerald-600 text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Sell {symbol}
        </button>
      </div>

      <div className="flex gap-1 text-xs">
        {(["market", "limit", "stop"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "px-3 py-1.5 rounded-md capitalize transition",
              mode === m ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Available</span>
          <span className="font-mono text-foreground">${usdBal.toLocaleString()}</span>
        </div>

        {mode !== "market" && (
          <Field label={`Price (${quote})`}>
            <input
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder={price ? price.toFixed(2) : "0.00"}
              className="w-full bg-transparent text-right font-mono outline-none"
              inputMode="decimal"
            />
          </Field>
        )}

        <Field label={`Amount (${symbol})`}>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent text-right font-mono outline-none"
            inputMode="decimal"
          />
        </Field>

        <div className="grid grid-cols-4 gap-1 text-xs">
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              onClick={() => setPct(p)}
              className="rounded-md bg-white/5 py-1.5 hover:bg-white/10 transition text-muted-foreground hover:text-foreground"
            >
              {p}%
            </button>
          ))}
        </div>

        <div className="pt-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Leverage</span>
            <span className="font-mono text-foreground">{leverage}×</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="w-full mt-2 accent-primary"
          />
        </div>
      </div>

      <div className="border-t border-white/5 pt-3 space-y-1.5 text-xs font-mono">
        <Row label="Order value" value={"$" + total.toFixed(2)} />
        <Row label="Est. fee (0.10%)" value={"$" + fee.toFixed(2)} />
        <Row label="Slippage" value="0.05%" />
      </div>

      <button
        onClick={handleSubmit}
        className={cn(
          "w-full rounded-lg py-3 text-sm font-semibold transition shadow-glow",
          side === "buy"
            ? "bg-success text-success-foreground hover:opacity-90"
            : "bg-emerald-600 text-white hover:opacity-90",
        )}
      >
        {side === "buy" ? "Buy" : "Sell"} {symbol} — {mode.toUpperCase()}
      </button>

      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {side === "buy" ? "Buy" : "Sell"} {symbol} · Cross-chain Swap
            </DialogTitle>
            <DialogDescription>
              Execute your {side} order via a real cross-chain swap powered by thirdweb Bridge.
            </DialogDescription>
          </DialogHeader>
          {!session ? (
            <div className="glass rounded-xl p-6 text-sm text-center space-y-3">
              <p className="text-muted-foreground">Connect a wallet to trade.</p>
              <Link
                to="/wallet"
                className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Open Wallet
              </Link>
            </div>
          ) : !privateKey ? (
            <div className="glass rounded-xl p-6 text-sm text-center space-y-3">
              <p className="text-muted-foreground">
                Re-open your wallet to re-enable swap signing (private key is kept in memory only).
              </p>
              <Link
                to="/wallet"
                className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Go to Wallet
              </Link>
            </div>
          ) : (
            <SwapWidget privateKey={privateKey} address={session.address} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block glass rounded-lg px-3 py-2">
      <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

interface CustomToken {
  chain: string;
  contract: string;
  symbol: string;
  name: string;
  price: number;
  change24h?: number;
  volume24h?: number;
  marketCap?: number;
}

const QUOTES = ["USDT", "BTC", "ETH", "SOL", "BNB"];

const DEX_CHAIN_IDS: Record<string, string> = {
  ETH: "ethereum", BNB: "bsc", MATIC: "polygon", BASE: "base", SOL: "solana",
  OP: "optimism", ARB: "arbitrum", AVAX: "avalanche", LINEA: "linea", BERA: "berachain",
  MNT: "mantle", ZETA: "zetachain", ZKSYNC: "zksync", MON: "monad", HYPE: "hyperevm",
};
function dexChain(c: string) {
  return DEX_CHAIN_IDS[c] ?? c.toLowerCase();
}

function fmtNum(n: number) {
  if (!n) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

function CustomPairForm({ onLoaded, active }: { onLoaded: (t: CustomToken) => void; active: CustomToken | null }) {
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = async (e: React.FormEvent) => {
    e.preventDefault();
    const contract = addr.trim();
    if (!contract) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/token-meta?contract=${encodeURIComponent(contract)}`);
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || "Token not found");
      // Extra 24h stats from DexScreener (public, no key needed).
      let extra: Partial<CustomToken> = {};
      try {
        const d = await (await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contract}`)).json();
        const p = (d?.pairs ?? []).sort((a: any, b: any) => Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0))[0];
        if (p) extra = { change24h: Number(p.priceChange?.h24 ?? 0), volume24h: Number(p.volume?.h24 ?? 0), marketCap: Number(p.marketCap ?? p.fdv ?? 0) };
      } catch { /* optional */ }
      onLoaded({ chain: j.chain, contract: j.contract, symbol: j.symbol, name: j.name, price: Number(j.price) || 0, ...extra });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={load} className="mt-2 border-t border-white/5 p-3 space-y-2">
      <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Trade a new pair</h3>
      <input
        value={addr}
        onChange={(e) => setAddr(e.target.value)}
        placeholder="Paste token contract address"
        aria-label="Token contract address"
        className="w-full rounded-lg bg-white/5 px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-primary"
      />
      <button disabled={busy} className="w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">
        {busy ? "Detecting token…" : "Load pair"}
      </button>
      {err && <p className="text-xs text-destructive">{err}</p>}
      {active && <p className="text-xs text-muted-foreground">Trading <span className="text-foreground font-medium">{active.name}</span> ({active.chain})</p>}
    </form>
  );
}

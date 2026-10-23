import { brandPreviewMeta } from "@/lib/brand";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { ArrowDown, ArrowDownUp, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, CircleDollarSign, Download, Globe2, RefreshCw, Search, Star, TrendingUp } from "lucide-react";
import { marketsQuery, globalMarketQuery, formatUSD, formatCompact, formatPct, type Coin } from "@/lib/prices";
import { Sparkline } from "@/components/Sparkline";
import { MarketPriceChart } from "@/components/markets/MarketPriceChart";
import { MarketPulse } from "@/components/markets/MarketPulse";
import { formatMarketCapitalization } from "@/lib/market-pulse";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/markets")({
  head: () => ({ meta: [
      ...brandPreviewMeta,
    { title: "Markets Terminal — PrimeCapital Exchange" },
    { name: "description", content: "Explore live crypto prices, interactive price history, market leaders and your watchlist in the PrimeCapital markets terminal." },
    { property: "og:title", content: "Markets Terminal — PrimeCapital Exchange" },
    { property: "og:description", content: "Live cryptocurrency markets, price charts and personalized watchlists." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: MarketsPage,
});
type SortKey = "market_cap" | "price" | "change" | "volume";
type Filter = "all" | "gainers" | "losers";

// Non-sensitive local preference: the device's saved watchlist.
const WATCHLIST_KEY = "prime:watchlist:v1";

function readWatchlist(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(WATCHLIST_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function MarketsPage() {
  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useQuery(marketsQuery(100));
  const global = useQuery(globalMarketQuery);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("market_cap");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"all" | "watchlist">("all");
  const [sideTab, setSideTab] = useState<"leaders" | "watchlist">("leaders");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState("bitcoin");
  useEffect(() => { setFavs(readWatchlist()); }, []);
  const assets = data ?? [];
  const active = assets.find((coin) => coin.id === selected) ?? assets[0];
  const coins = useMemo(() => [...(data ?? [])].filter((c) =>
    (tab === "all" || favs.has(c.id)) &&
    (filter === "all" || (filter === "gainers" ? c.price_change_percentage_24h > 0 : c.price_change_percentage_24h < 0)) &&
    (!q || `${c.name} ${c.symbol}`.toLowerCase().includes(q.toLowerCase()))
  ).sort((a, b) => dir === "asc" ? pick(a, sort) - pick(b, sort) : pick(b, sort) - pick(a, sort)), [data, tab, favs, filter, q, dir, sort]);
  const totalPages = Math.max(1, Math.ceil(coins.length / 10));
  const currentPage = Math.min(page, totalPages);
  const rows = coins.slice((currentPage - 1) * 10, currentPage * 10);
  const totalCap = assets.reduce((sum, coin) => sum + coin.market_cap, 0);
  const totalVolume = assets.reduce((sum, coin) => sum + coin.total_volume, 0);
  const advancing = assets.filter((coin) => coin.price_change_percentage_24h > 0).length;
  const btc = assets.find((coin) => coin.id === "bitcoin");
  const sideAssets = sideTab === "leaders" ? [...assets].sort((a, b) => b.total_volume - a.total_volume).slice(0, 6) : assets.filter((coin) => favs.has(coin.id)).slice(0, 6);
  const toggleFav = (id: string) => setFavs((previous) => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); try { window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...next])); } catch { /* ignore */ } return next; });
  const toggleSort = (key: SortKey) => { setPage(1); if (sort === key) setDir(dir === "asc" ? "desc" : "asc"); else { setSort(key); setDir("desc"); } };
  const exportCSV = () => {
    const csv = [["Rank", "Asset", "Symbol", "Price USD", "24h %", "Market cap USD", "Volume USD"], ...coins.map((coin) => [coin.market_cap_rank, coin.name, coin.symbol, coin.current_price, coin.price_change_percentage_24h, coin.market_cap, coin.total_volume])].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "primecapital-markets.csv"; anchor.click(); URL.revokeObjectURL(url);
  };
  return <div className="markets-terminal">
    <MarketPulse coins={assets} loading={isLoading} onSelect={setSelected} />
    <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
      <header className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0"><div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase text-muted-foreground"><Globe2 className="h-3 w-3" />Global markets<span className="text-primary">/ Overview</span></div><h1 className="text-2xl font-semibold sm:text-3xl">Market overview<span className="text-primary">.</span></h1></div>
        <div className="flex shrink-0 items-center gap-3"><span className="hidden text-xs font-mono text-muted-foreground sm:block">{dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connecting"}</span><Button variant="outline" size="sm" onClick={() => { void refetch(); void global.refetch(); }} disabled={isFetching || global.isFetching} aria-label="Refresh markets" title="Refresh markets"><RefreshCw className={cn(isFetching && "animate-spin")} /><span className="hidden sm:inline">Refresh</span></Button></div>
      </header>
      {isError && <div className="mb-5 flex items-center justify-between gap-3 border border-warning/30 bg-warning/5 p-3 text-sm text-warning">Market data is temporarily unavailable.<Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></div>}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Global market capitalization" value={global.data ? formatMarketCapitalization(global.data.marketCap) : "—"} note={global.data ? `Worldwide · ${new Date(global.data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${global.isError ? " · Update delayed" : ""}` : global.isError ? "Global data unavailable" : "Connecting…"} icon={<Globe2 className="h-4 w-4" />} change={global.data?.change24h} />
        <Metric label="24h trading volume" value={data ? `$${formatCompact(totalVolume)}` : "—"} note="Top 100 assets" icon={<BarChart3 className="h-4 w-4" />} prices={assets[1]?.sparkline_in_7d?.price} />
        <Metric label="Bitcoin share" value={data && totalCap ? `${((btc?.market_cap ?? 0) / totalCap * 100).toFixed(2)}%` : "—"} note="Of tracked market cap" icon={<CircleDollarSign className="h-4 w-4" />} prices={btc?.sparkline_in_7d?.price} />
        <Metric label="Market breadth" value={data ? `${advancing} / ${assets.length}` : "—"} note="Assets advancing · 24h" icon={<TrendingUp className="h-4 w-4" />} prices={assets[2]?.sparkline_in_7d?.price} />
      </div>
      <div className="mb-7 grid gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 sm:p-5">
            <div className="flex min-w-0 items-center gap-3">{active && <img src={active.image} alt="" className="h-9 w-9 shrink-0 rounded-full" />}<div className="min-w-0"><select aria-label="Chart asset" value={active?.id ?? ""} onChange={(event) => setSelected(event.target.value)} className="max-w-full bg-surface font-semibold outline-none">{assets.map((coin) => <option key={coin.id} value={coin.id}>{coin.name} / USD</option>)}</select><div className="mt-1 flex items-center gap-2 text-[10px] uppercase text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-success" />Spot market<span className="text-border">|</span>Live TradingView</div></div></div>
            <div className="text-right"><p className="font-mono text-lg font-medium sm:text-2xl">{active ? formatUSD(active.current_price) : "—"}</p><Change value={active?.price_change_percentage_24h} /></div>
          </div>
          <MarketPriceChart coin={active} />
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground"><span>Chart · TradingView</span>{active && <Button asChild variant="link" size="sm" className="h-auto p-0"><Link to="/coin/$coinId" params={{ coinId: active.id }}>Trade {active.symbol.toUpperCase()}<ArrowUpRight /></Link></Button>}</div>
        </section>
        <aside className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border p-3"><div className="flex gap-1">{(["leaders", "watchlist"] as const).map((value) => <Button key={value} size="sm" variant="ghost" onClick={() => setSideTab(value)} className={cn(sideTab === value ? "bg-primary/10 text-primary" : "text-muted-foreground")}>{value === "leaders" ? "Market leaders" : "My watchlist"}</Button>)}</div><Star className="h-4 w-4 text-muted-foreground" /></div>
          <div className="flex justify-between px-4 py-3 text-[10px] uppercase text-muted-foreground"><span>Asset</span><span>Price / 24h</span></div>
          {sideAssets.map((coin) => <Button key={coin.id} variant="ghost" onClick={() => setSelected(coin.id)} className={cn("grid h-[49px] w-full grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-none px-4", active?.id === coin.id && "bg-primary/5")}><span className="flex min-w-0 items-center gap-2.5"><img src={coin.image} alt="" className="h-6 w-6 shrink-0 rounded-full" /><span className="text-left"><span className="block text-xs font-semibold">{coin.symbol.toUpperCase()}</span><span className="block max-w-[120px] truncate text-[10px] text-muted-foreground">{coin.name}</span></span></span><span className="text-right"><span className="block font-mono text-xs">{formatUSD(coin.current_price)}</span><Change value={coin.price_change_percentage_24h} className="text-[10px]" /></span></Button>)}
          {sideAssets.length === 0 && <div className="grid h-[294px] place-items-center px-5 text-center text-xs text-muted-foreground">{isLoading ? "Loading assets…" : "Your watchlist is empty"}</div>}
          <div className="mt-3 border-t border-border px-4 py-4"><div className="mb-2.5 flex justify-between text-xs"><span className="text-muted-foreground">24h market direction</span><span className="font-mono text-success">{data && assets.length ? `${Math.round(advancing / assets.length * 100)}% advancing` : "—"}</span></div><div className="flex h-1.5 overflow-hidden rounded-full bg-muted">{assets.map((coin) => <span key={coin.id} className={cn("h-full flex-1", coin.price_change_percentage_24h >= 0 ? "bg-success" : "bg-destructive")} />)}</div><div className="mt-2 flex justify-between text-[10px] font-mono text-muted-foreground"><span>{advancing} gainers</span><span>{assets.filter((coin) => coin.price_change_percentage_24h < 0).length} losers</span></div></div>
        </aside>
      </div>
      <section>
        <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><h2 className="text-lg font-semibold">Cryptocurrency markets</h2><p className="mt-1 text-xs text-muted-foreground">Market performance at a glance</p></div><Button variant="outline" size="sm" onClick={exportCSV} disabled={!coins.length} className="justify-self-start sm:justify-self-end"><Download />Export CSV</Button></div>
        <div className="rounded-lg border border-border bg-surface">
          <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-2">{(["all", "watchlist"] as const).map((value) => <Button variant="ghost" size="sm" key={value} onClick={() => { setTab(value); setPage(1); }} className={cn(tab === value ? "text-primary bg-primary/10" : "text-muted-foreground")}>{value === "all" ? "All assets" : "Watchlist"}{value === "all" && <span className="font-mono text-[10px]">{assets.length}</span>}</Button>)}<span className="mx-1 h-4 border-l border-border" /><select aria-label="Market performance filter" value={filter} onChange={(e) => { setFilter(e.target.value as Filter); setPage(1); }} className="min-w-0 bg-surface text-xs text-muted-foreground outline-none"><option value="all">All performance</option><option value="gainers">Gainers</option><option value="losers">Losers</option></select></div><div className="relative lg:w-64"><Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><input aria-label="Search markets" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search assets…" className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-xs outline-none focus:ring-1 focus:ring-ring" /></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><thead className="border-b border-border bg-surface-2/50 text-[10px] uppercase text-muted-foreground"><tr><th className="w-10" /><th className="py-3 text-left">#</th><th className="py-3 text-left">Asset</th><SortTh label="Price" k="price" sort={sort} dir={dir} onClick={toggleSort} /><SortTh label="24h %" k="change" sort={sort} dir={dir} onClick={toggleSort} /><th className="hidden px-3 text-right xl:table-cell">7d %</th><SortTh label="Market cap" k="market_cap" sort={sort} dir={dir} onClick={toggleSort} className="hidden md:table-cell" /><SortTh label="Volume (24h)" k="volume" sort={sort} dir={dir} onClick={toggleSort} className="hidden lg:table-cell" /><th className="hidden px-4 text-right xl:table-cell">Last 7 days</th><th className="w-12" /></tr></thead><tbody className="divide-y divide-border/50">
            {isLoading && Array.from({ length: 10 }, (_, index) => <tr key={index}><td colSpan={10} className="p-4"><div className="h-5 animate-pulse rounded bg-muted" /></td></tr>)}
            {rows.map((coin) => <tr key={coin.id} onClick={() => navigate({ to: "/coin/$coinId", params: { coinId: coin.id } })} className="cursor-pointer transition-colors hover:bg-surface-2"><td className="px-1"><Button variant="ghost" size="icon" className={cn("h-8 w-8", favs.has(coin.id) ? "text-primary" : "text-muted-foreground")} aria-label={`${favs.has(coin.id) ? "Remove" : "Add"} ${coin.name} ${favs.has(coin.id) ? "from" : "to"} watchlist`} title="Toggle watchlist" onClick={(e) => { e.stopPropagation(); toggleFav(coin.id); }}><Star fill={favs.has(coin.id) ? "currentColor" : "none"} className="h-3.5 w-3.5" /></Button></td><td className="font-mono text-muted-foreground">{coin.market_cap_rank}</td><td className="py-3.5 pr-3"><div className="flex items-center gap-2.5"><img src={coin.image} alt="" className="h-7 w-7 shrink-0 rounded-full" /><div className="min-w-0"><p className="font-medium">{coin.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{coin.symbol.toUpperCase()}</p></div></div></td><td className="px-3 text-right font-mono whitespace-nowrap">{formatUSD(coin.current_price)}</td><td className="px-3 text-right whitespace-nowrap"><Change value={coin.price_change_percentage_24h} /></td><td className="hidden px-3 text-right whitespace-nowrap xl:table-cell"><Change value={coin.price_change_percentage_7d_in_currency} /></td><td className="hidden px-3 text-right font-mono text-muted-foreground md:table-cell">${formatCompact(coin.market_cap)}</td><td className="hidden px-3 text-right font-mono text-muted-foreground lg:table-cell">${formatCompact(coin.total_volume)}</td><td className="hidden px-4 xl:table-cell"><Sparkline data={coin.sparkline_in_7d?.price ?? []} up={(coin.price_change_percentage_7d_in_currency ?? coin.price_change_percentage_24h) >= 0} width={95} height={27} className="ml-auto" /></td><td className="pr-3"><Button asChild size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"><Link aria-label={`View ${coin.name}`} to="/coin/$coinId" params={{ coinId: coin.id }}><ArrowUpRight /></Link></Button></td></tr>)}
            {!isLoading && rows.length === 0 && <tr><td colSpan={10} className="py-16 text-center text-muted-foreground">{tab === "watchlist" && !favs.size ? "Your watchlist is empty" : "No matching assets"}</td></tr>}
          </tbody></table></div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-[11px] text-muted-foreground"><span>Showing {coins.length ? (currentPage - 1) * 10 + 1 : 0}–{Math.min(currentPage * 10, coins.length)} of {coins.length}</span><div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Previous page" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft /></Button><span className="font-mono">{currentPage} / {totalPages}</span><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Next page" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight /></Button></div></div>
        </div>
      </section>
      <div className="mt-5 flex items-center justify-between text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-success" />Powered by CoinGecko</span><span>All prices in USD</span></div>
    </div>
  </div>;
}
function Change({ value, className }: { value?: number | null; className?: string }) { return <span className={cn("font-mono text-xs", value == null ? "text-muted-foreground" : value >= 0 ? "text-success" : "text-destructive", className)}>{formatPct(value)}</span>; }
function Metric({ label, value, note, icon, prices, change }: { label: string; value: string; note: string; icon: React.ReactNode; prices?: number[]; change?: number }) { return <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-4"><div className="mb-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground"><span>{label}</span><span className="shrink-0 text-primary/70">{icon}</span></div><div className="relative z-10 flex flex-wrap items-center gap-2"><p className="min-w-0 break-all font-mono text-xl font-medium">{value}</p>{change != null && <span className="whitespace-nowrap"><Change value={change} /><span className="ml-1 text-[10px] text-muted-foreground">24h</span></span>}</div><div className="mt-3 flex items-end justify-between gap-2"><span className="text-[10px] text-muted-foreground">{note}</span><Sparkline data={prices ?? []} up width={64} height={20} className="shrink-0 opacity-60" /></div></div>; }
function pick(c: Coin, key: SortKey) { return key === "price" ? c.current_price : key === "change" ? c.price_change_percentage_24h ?? 0 : key === "volume" ? c.total_volume : c.market_cap; }
function SortTh({ label, k, sort, dir, onClick, className }: { label: string; k: SortKey; sort: SortKey; dir: "asc" | "desc"; onClick: (key: SortKey) => void; className?: string }) { return <th className={cn("px-3 text-right", className)}><Button variant="ghost" size="sm" onClick={() => onClick(k)} className={cn("h-auto gap-1 p-0 text-[10px] uppercase", sort === k ? "text-foreground" : "text-muted-foreground")}>{label}{sort === k ? <ArrowDown className={cn("size-3", dir === "asc" && "rotate-180")} /> : <ArrowDownUp className="size-3 opacity-40" />}</Button></th>; }

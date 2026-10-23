import { brandPreviewMeta } from "@/lib/brand";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bookmark, ChevronRight, Clock3, Globe2, Newspaper, RefreshCw, Search, X } from "lucide-react";
import { newsQuery, type NewsItem } from "@/lib/news";
import { articleCategory, articleSource, articleTime, newsCategories, type NewsCategory } from "@/lib/news-presentation";
import { NewsArticle, NewsImage, SaveArticle } from "@/components/NewsArticle";
import { NewsSidebar } from "@/components/NewsSidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/BrandText";

export const Route = createFileRoute("/news")({
  head: () => ({ meta: [
      ...brandPreviewMeta,
    { title: "Market Intelligence — PrimeCapital News" },
    { name: "description", content: "Explore cryptocurrency news, market analysis and the latest digital asset briefings from PrimeCapital's existing news feeds." },
    { property: "og:title", content: "Market Intelligence — PrimeCapital News" },
    { property: "og:description", content: "Cryptocurrency headlines, editorial briefings and market prices in one financial news desk." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: NewsPage,
});

function NewsPage() {
  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useQuery(newsQuery);
  const [category, setCategory] = useState<NewsCategory>("All news");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState<NewsItem | null>(null);
  useEffect(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem("primecapital-saved-news") ?? "[]");
      if (Array.isArray(value)) setSaved(value.filter((entry): entry is string => typeof entry === "string"));
    } catch { /* Invalid preferences do not interrupt the news feed. */ }
  }, []);
  const toggleSaved = (url: string) => setSaved((previous) => {
    const next = previous.includes(url) ? previous.filter((entry) => entry !== url) : [...previous, url];
    try { localStorage.setItem("primecapital-saved-news", JSON.stringify(next)); } catch { /* Saving remains available for this visit. */ }
    return next;
  });
  const items = useMemo(() => [...(data ?? [])].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)), [data]);
  const filtered = useMemo(() => items.filter((item) => (!savedOnly || saved.includes(item.url)) && (category === "All news" || articleCategory(item) === category) && `${item.title} ${item.summary} ${articleSource(item)}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === "oldest" ? Date.parse(a.publishedAt) - Date.parse(b.publishedAt) : Date.parse(b.publishedAt) - Date.parse(a.publishedAt)), [items, savedOnly, saved, category, search, sort]);
  const featured = filtered[0];
  return <div className="news-terminal bg-background">
    <div className="border-b border-border bg-surface"><div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8"><span className="flex h-12 shrink-0 items-center gap-2 border-r border-border pr-4 text-[10px] font-semibold uppercase text-primary"><Newspaper className="h-3.5 w-3.5" /><Brand /> briefing</span>{items[0] ? <Button variant="ghost" onClick={() => setSelected(items[0])} className="h-12 min-w-0 flex-1 justify-between rounded-none px-0 text-xs"><span className="truncate text-muted-foreground">{items[0].title}</span><ChevronRight className="shrink-0 text-primary" /></Button> : <span className="truncate text-xs text-muted-foreground">{isLoading ? "Connecting to the news desk…" : "No new briefings available"}</span>}</div></div>
    <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-5 pb-6"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase text-muted-foreground"><Globe2 className="h-3 w-3" />News desk<span className="text-primary">/ Intelligence</span></div><h1 className="text-3xl font-semibold sm:text-4xl">Market intelligence<span className="text-primary">.</span></h1><p className="mt-2 text-xs text-muted-foreground">Stay informed. See the bigger picture.</p></div><div className="flex items-center gap-2"><span className="mr-2 hidden items-center gap-1.5 font-mono text-[10px] text-muted-foreground md:flex"><Clock3 className="h-3 w-3" />{dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connecting"}</span><Button variant={savedOnly ? "default" : "outline"} size="sm" onClick={() => setSavedOnly(!savedOnly)} aria-pressed={savedOnly}><Bookmark />Saved ({saved.length})</Button><Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching} aria-label="Refresh news" title="Refresh news"><RefreshCw className={cn(isFetching && "animate-spin")} /></Button></div></header>
      <nav aria-label="News categories" className="mb-6 flex gap-1 overflow-x-auto border-y border-border py-2">{newsCategories.map((value) => <Button key={value} variant="ghost" size="sm" onClick={() => setCategory(value)} aria-pressed={category === value} className={cn("shrink-0 rounded-sm", category === value ? "bg-primary/10 text-primary" : "text-muted-foreground")}>{value}</Button>)}</nav>
      {isError && <div role="alert" className="mb-6 flex items-center justify-between gap-3 border border-warning/30 bg-warning/5 p-3 text-xs text-warning"><span>{data ? "News updates are delayed. Showing the last available headlines." : "News is temporarily unavailable."}</span><Button variant="outline" size="sm" onClick={() => void refetch()}>Retry</Button></div>}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.9fr)_minmax(260px,1fr)] lg:gap-10">
        <div className="min-w-0">
          {isLoading ? <div className="aspect-[16/9] animate-pulse rounded-lg bg-surface-2" /> : featured && <article className="group relative isolate min-h-[380px] overflow-hidden rounded-lg bg-surface sm:min-h-[430px]"><div className="absolute inset-0 -z-20"><NewsImage key={featured.id} item={featured} featured /></div><div className="news-feature-shade absolute inset-0 -z-10" /><div className="flex min-h-[380px] flex-col justify-between gap-10 p-5 sm:min-h-[430px] sm:p-7"><div className="flex items-start justify-between"><span className="border border-foreground/20 bg-background/70 px-2.5 py-1.5 text-[9px] font-semibold uppercase text-primary">Featured briefing</span><div className="rounded-md bg-background/70"><SaveArticle saved={saved.includes(featured.url)} onSave={() => toggleSaved(featured.url)} title={featured.title} /></div></div><div><div className="mb-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground"><span className="text-primary">{articleCategory(featured)}</span><span>{articleSource(featured)}</span><time dateTime={featured.publishedAt}>{articleTime(featured.publishedAt)}</time></div><h2 className="max-w-2xl text-2xl font-semibold leading-tight sm:text-3xl">{featured.title}</h2><p className="mt-3 line-clamp-2 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">{featured.summary}</p><Button size="sm" className="mt-5" onClick={() => setSelected(featured)}>Read briefing<ArrowUpRight /></Button></div></div></article>}
          <section aria-label="Article feed" className="mt-7"><div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">{savedOnly ? "Saved stories" : "Latest stories"}<span className="ml-3 font-mono text-[10px] text-muted-foreground">{filtered.length}</span></h2><select aria-label="Sort articles" value={sort} onChange={(event) => setSort(event.target.value)} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-ring"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input aria-label="Search news" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search topics, headlines, token symbols…" className="h-10 w-full rounded-md border border-border bg-surface pl-10 pr-10 text-xs outline-none focus:ring-1 focus:ring-ring" />{search && <Button variant="ghost" size="icon" aria-label="Clear news search" onClick={() => setSearch("")} className="absolute right-1 top-1 h-8 w-8"><X /></Button>}</div>{isLoading ? Array.from({ length: 4 }, (_, index) => <div key={index} className="my-5 h-28 animate-pulse rounded-md bg-surface-2" />) : filtered.length ? filtered.map((item) => <NewsArticle key={item.id} item={item} saved={saved.includes(item.url)} onSave={() => toggleSaved(item.url)} onOpen={() => setSelected(item)} />) : <div className="py-16 text-center"><Newspaper className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">{savedOnly ? "No saved stories match this view." : "No stories match this view."}</p>{(search || category !== "All news" || savedOnly) && <Button variant="link" className="mt-2" onClick={() => { setSearch(""); setCategory("All news"); setSavedOnly(false); }}>Show all news</Button>}</div>}</section>
        </div>
        <NewsSidebar items={items} onOpen={setSelected} />
      </div>
      <div className="mt-10 flex items-center justify-between border-t border-border pt-4 text-[10px] text-muted-foreground"><span><Brand /> / Market intelligence</span><span>Prices in USD</span></div>
      <div className="mt-12 flex justify-center"><Link to="/mixman" aria-label="." title="." className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20 transition-colors hover:bg-muted-foreground/40" /></div>
    </main>
    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg border-border bg-surface p-5 sm:p-7">{selected && <><p className="pr-8 text-[10px] font-semibold uppercase text-primary">{articleCategory(selected)} / Briefing</p><DialogTitle className="pr-5 text-xl leading-snug sm:text-2xl">{selected.title}</DialogTitle><DialogDescription className="text-xs">{articleSource(selected)} · {articleTime(selected.publishedAt)}</DialogDescription>{selected.image && <div className="aspect-[16/9] overflow-hidden rounded-md"><NewsImage key={selected.id} item={selected} /></div>}<p className="text-sm leading-relaxed text-muted-foreground">{selected.summary}</p><div className="flex items-center justify-between gap-3 border-t border-border pt-4"><Button asChild size="sm"><a href={selected.url} target="_blank" rel="noreferrer">Read original article<ArrowUpRight /></a></Button><SaveArticle saved={saved.includes(selected.url)} onSave={() => toggleSaved(selected.url)} title={selected.title} /></div></>}</DialogContent></Dialog>
  </div>;
}

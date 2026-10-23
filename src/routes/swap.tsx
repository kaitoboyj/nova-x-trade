import { brandPreviewMeta } from "@/lib/brand";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brand } from "@/components/BrandText";
import {
  ArrowLeftRight,
  Wallet,
  ArrowUpRight,
  ShieldCheck,
  Layers3,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChangeBadge } from "@/components/ChangeBadge";
import { marketsQuery, formatUSD } from "@/lib/prices";
import { brandLogo } from "@/lib/brand";
import { useWalletSession } from "@/hooks/useWalletSession";
import { getPrivateKey } from "@/lib/wallet-signer";
import { SwapWidget } from "@/components/SwapWidget";
import { DcaPanel } from "@/components/DcaPanel";

export const Route = createFileRoute("/swap")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...brandPreviewMeta,
      { title: "Swap — PrimeCapital Cross-Chain" },
      {
        name: "description",
        content:
          "Bridge and swap tokens across chains directly from your self-custody wallet, powered by thirdweb Bridge.",
      },
      { property: "og:title", content: "Cross-chain swap · PrimeCapital" },
      {
        property: "og:description",
        content: "Real on-chain cross-chain swaps from your imported or generated wallet.",
      },
    ],
  }),
  component: SwapPage,
});

function SwapPage() {
  const session = useWalletSession();
  const { data: markets } = useQuery(marketsQuery(100));
  const featured = ["bitcoin", "ethereum", "solana", "binancecoin"]
    .map((id) => markets?.find((coin) => coin.id === id))
    .filter((coin) => coin != null);
  const [pk, setPk] = useState<string | null | undefined>(undefined);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener("prime:signer-change", refresh);
    return () => window.removeEventListener("prime:signer-change", refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!session?.address) {
      setPk(null);
      return;
    }

    setPk(undefined);
    const started = Date.now();
    const refresh = () => {
      const key = getPrivateKey(session.address);
      if (cancelled) return;
      if (key) {
        setPk(key);
        return;
      }
      if (Date.now() - started < 2500) {
        window.setTimeout(refresh, 250);
      } else {
        setPk(null);
      }
    };
    refresh();
    return () => {
      cancelled = true;
    };
  }, [session?.address, tick]);

  return (
    <div className="swap-terminal mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] uppercase text-muted-foreground">
            <Brand /> <span className="text-primary">/ Cross-chain</span>
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Swap assets<span className="text-primary">.</span>
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">Across chains. On your terms.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/wallet">
            <Wallet />
            Your wallet
            <ArrowUpRight />
          </Link>
        </Button>
      </header>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-y border-border bg-surface px-4 py-3">
        <span className="flex items-center gap-2 text-xs">
          <span
            className={
              session
                ? "h-1.5 w-1.5 rounded-full bg-success"
                : "h-1.5 w-1.5 rounded-full bg-muted-foreground"
            }
          />
          {session ? session.username : "Wallet not connected"}
          {session && (
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
              {session.address.slice(0, 6)}…{session.address.slice(-4)}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Layers3 className="h-3.5 w-3.5 text-primary" />
          EVM networks <span className="text-primary">/</span> thirdweb Bridge
        </span>
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,.85fr)]">
        <section className="py-4">
          <img src={brandLogo} alt="PrimeCapital" className="mb-6 h-16 w-16 object-contain" />
          <p className="text-[10px] uppercase text-primary">Cross-chain exchange</p>
          <h2 className="mt-3 text-2xl font-semibold leading-tight">
            A new network.
            <br />
            The same wallet.
          </h2>
          <div className="mt-8 border-t border-border">
            <div className="flex gap-3 border-b border-border py-5">
              <ArrowLeftRight className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <h3 className="text-xs font-semibold">Swap & bridge</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Tokens move on-chain from your wallet address.
                </p>
              </div>
            </div>
            <div className="flex gap-3 border-b border-border py-5">
              <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
              <div>
                <h3 className="text-xs font-semibold">Locally signed</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Review your quote before signing a transaction.
                </p>
              </div>
            </div>
          </div>
          <Link
            to="/how-it-works"
            className="mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
          >
            How it works
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </section>
        <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              Swap terminal
            </span>
            <span className="text-[10px] text-muted-foreground">Cross-chain</span>
          </div>
          <div className="px-4 py-5 sm:px-5">
            {!session ? (
              <NeedsWallet reason="signin" />
            ) : pk === undefined ? (
              <div className="flex min-h-80 items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Loading wallet signer…
              </div>
            ) : !pk ? (
              <NeedsWallet reason="rehydrate" />
            ) : (
              <SwapWidget privateKey={pk} address={session.address} />
            )}
          </div>
          <div className="border-t border-border px-5 py-3 text-center text-[10px] text-muted-foreground">
            Network fees and route availability depend on your quote.
          </div>
        </section>
        <aside className="min-w-0">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-sm font-semibold">Market snapshot</h2>
            <Link to="/markets" className="text-[10px] text-primary">
              View markets ↗
            </Link>
          </div>
          <div>
            {featured.length ? (
              featured.map((coin) => (
                <Link
                  key={coin.id}
                  to="/coin/$coinId"
                  params={{ coinId: coin.id }}
                  className="flex items-center gap-3 border-b border-border py-5"
                >
                  <img src={coin.image} alt="" className="h-8 w-8 rounded-full" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{coin.symbol.toUpperCase()}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{coin.name}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="font-mono text-xs">{formatUSD(coin.current_price)}</p>
                    <div className="mt-1">
                      <ChangeBadge pct={coin.price_change_percentage_24h} />
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="py-8 text-xs text-muted-foreground">Market prices loading…</p>
            )}
          </div>
          <p className="mt-5 text-[10px] leading-5 text-muted-foreground">
            Indicative market prices. Your executable rate is shown in the swap quote.
          </p>
        </aside>
      </div>
      {session && pk ? (
        <div className="mt-8">
          <DcaPanel address={session.address} />
        </div>
      ) : null}
    </div>
  );
}

function NeedsWallet({ reason }: { reason: "signin" | "rehydrate" }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        <Wallet className="h-6 w-6 text-primary" />
      </div>
      <h2 className="mt-4 font-display text-xl font-semibold">
        {reason === "signin" ? "Sign in with a wallet" : "Unlock your wallet"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        {reason === "signin"
          ? "Create or import a wallet to enable cross-chain swaps."
          : "Your session is active but the signing key is not loaded in this tab. Re-open your wallet to unlock swapping."}
      </p>
      <Button asChild className="mt-6">
        <Link to="/wallet">
          <Wallet />
          Go to Wallet
          <ArrowUpRight />
        </Link>
      </Button>
    </div>
  );
}

import { brandPreviewMeta } from "@/lib/brand";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, KeyRound, Newspaper, ShieldCheck, Sparkles, UserCheck, Wallet2 } from "lucide-react";
import { Brand, Branded } from "@/components/BrandText";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...brandPreviewMeta,
      { title: "How It Works — PrimeCapital Exchange" },
      { name: "description", content: "Learn how PrimeCapital works: create or import a self-custody wallet, sign in with your wallet, trade with live TradingView charts, and follow crypto news." },
      { property: "og:title", content: "How PrimeCapital Works" },
      { property: "og:description", content: "Self-custody wallets, real prices, real trading terminal — explained step by step." },
    ],
  }),
  component: HowItWorksPage,
});

const STEPS = [
  {
    icon: Wallet2,
    title: "1. Create or import a wallet",
    body: "Generate a fresh BIP39 seed phrase in your browser, or import an existing 12/24-word mnemonic. Keys are derived locally using BIP32/44/84 — the seed never touches our servers.",
  },
  {
    icon: UserCheck,
    title: "2. Pick a username",
    body: "The first time a wallet signs in, you choose a unique username. That username is permanently tied to your wallet address and used to identify you across the platform.",
  },
  {
    icon: KeyRound,
    title: "3. Sign in with your wallet",
    body: "There are no passwords and no emails. Whenever the wallet is active, you're signed in — anywhere your wallet goes, your PrimeCapital identity follows.",
  },
  {
    icon: BarChart3,
    title: "4. Trade like a pro",
    body: "Open the Terminal for live TradingView charts across BTC, ETH, SOL, BNB, XRP, DOGE and more, plus an order book and market data updated every few seconds.",
  },
  {
    icon: Sparkles,
    title: "5. Watch your balances",
    body: "The Home dashboard shows your total portfolio value in USD, plus native balances for each derived address (BTC, ETH and every EVM chain) fetched directly on-chain.",
  },
  {
    icon: Newspaper,
    title: "6. Stay on top of the news",
    body: "The News page pulls the freshest crypto headlines in real time so you can react before the market does.",
  },
  {
    icon: ShieldCheck,
    title: "7. Self-custody, always",
    body: "PrimeCapital never sees your mnemonic, private keys, or trades routed through your wallet. Back up your seed offline — anyone with those 12 words controls the wallet.",
  },
];

function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-14">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-xs uppercase tracking-widest text-primary/90 font-medium">Guide</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl font-semibold leading-tight">
          How <Brand className="text-gradient" /> works
        </h1>
        <p className="mt-4 text-muted-foreground">
          Everything you need to know to go from zero to trading with a self-custody wallet — in about a minute.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {STEPS.map((s) => (
          <div key={s.title} className="glass rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[image:var(--gradient-brand)]/20 border border-primary/20 text-primary">
                <s.icon className="h-5 w-5" />
              </span>
              <h3 className="font-display text-lg font-semibold">{s.title}</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              <Branded text={s.body} />
            </p>
          </div>
        ))}
      </div>

      <div className="glass-strong mt-10 rounded-2xl p-6 md:p-8 text-center">
        <h2 className="font-display text-2xl font-semibold">Ready to take custody?</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
          Create a wallet in ten seconds — no email, no password, no third party in between.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/wallet"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-brand)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            <Wallet2 className="h-4 w-4" /> Open Wallet
          </Link>
          <Link
            to="/trade"
            className="inline-flex items-center justify-center gap-2 rounded-lg glass px-5 py-2.5 text-sm font-semibold hover:bg-white/10"
          >
            <BarChart3 className="h-4 w-4" /> Launch Terminal
          </Link>
        </div>
      </div>
    </div>
  );
}

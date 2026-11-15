import { brandPreviewMeta } from "@/lib/brand";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  Copy,
  Gift,
  LineChart,
  Rocket,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand, Branded } from "@/components/BrandText";
import { useWalletSession } from "@/hooks/useWalletSession";
import { getReferralStatus } from "@/lib/referral.functions";
import { REFERRAL_CAP_PCT, REFERRAL_STEP_PCT } from "@/lib/referral";

export const Route = createFileRoute("/referral")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...brandPreviewMeta,
      { title: "Referral Program — PrimeCapital Exchange" },
      {
        name: "description",
        content:
          "Earn more yield on PrimeCapital by inviting friends. Every account gets its own referral code — the more people you bring, the more your yield grows.",
      },
      { property: "og:title", content: "PrimeCapital Referral Program" },
      {
        property: "og:description",
        content: "Share your code, grow the network, and unlock higher daily yields.",
      },
    ],
  }),
  component: ReferralPage,
});

const BENEFITS = [
  {
    icon: TrendingUp,
    title: "Yield growth",
    body: `Members of the referral program earn more yield than everyone else. Every friend who joins with your code adds +${REFERRAL_STEP_PCT}% to your daily yield — on top of your normal earnings.`,
  },
  {
    icon: Users,
    title: "Activation — the more you add, the more you earn",
    body: `The program rewards growth. The more active users you bring to the platform, the higher your yield climbs, up to a maximum bonus of +${REFERRAL_CAP_PCT}%. Your bonus grows with every new member you activate.`,
  },
  {
    icon: Gift,
    title: "Always on by default",
    body: "Referral codes are enabled for everyone by default. Create a wallet and your personal code is ready to share instantly — no application, no waiting.",
  },
  {
    icon: BadgeCheck,
    title: "A unique code, just for you",
    body: "Every account is issued its own referral code. Share it anywhere — your friends add it (it is optional) when they sign up, and the connection is recorded automatically.",
  },
];

const STEPS = [
  {
    icon: Wallet,
    title: "1. Create your account",
    body: "Generate or import a self-custody wallet and pick a username. Your username becomes your referral code.",
  },
  {
    icon: Share2,
    title: "2. Share your code",
    body: "Send your code to friends, or copy your invite link and post it anywhere.",
  },
  {
    icon: Rocket,
    title: "3. Friends join",
    body: "When they sign up they can enter your code in the optional referral field.",
  },
  {
    icon: LineChart,
    title: "4. Your yield grows",
    body: `Each activated friend raises your daily yield by +${REFERRAL_STEP_PCT}%, stacking up to +${REFERRAL_CAP_PCT}%.`,
  },
];

function ReferralPage() {
  const session = useWalletSession();
  const readStatus = useServerFn(getReferralStatus);
  const status = useQuery({
    queryKey: ["referral-status", session?.address],
    enabled: Boolean(session?.address),
    queryFn: () => readStatus({ data: { wallet_address: session!.address } }),
    refetchInterval: 30_000,
  });
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const code = status.data?.code ?? session?.username ?? null;
  const inviteLink =
    code && typeof window !== "undefined" ? `${window.location.origin}/wallet?ref=${code}` : "";

  const copy = async (value: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="wallet-terminal mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="glass-strong relative overflow-hidden rounded-2xl p-6 sm:p-10">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-widest text-primary">
            <Sparkles className="h-3 w-3" />
            Referral program
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
            Invite friends. <span className="text-gradient">Grow your yield.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            <Branded text="PrimeCapital rewards the people who grow the network. Share your personal code — the more users you bring, the more your daily yield grows." />
          </p>
          {!session && (
            <Button asChild className="mt-6 h-11">
              <Link to="/wallet">
                <Wallet className="h-4 w-4" />
                Create your account
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </section>

      {/* Live code card (signed in) */}
      {session && (
        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Share2 className="h-3.5 w-3.5 text-primary" />
              Your referral code
            </div>
            {status.isPending ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading your code…</p>
            ) : !status.data?.enabled ? (
              <p className="mt-4 text-sm text-muted-foreground">
                The referral program is currently paused by the platform. Check back soon.
              </p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2.5 font-mono text-lg font-semibold tracking-wider text-primary">
                    {code ?? "—"}
                  </span>
                  {code && (
                    <Button variant="outline" onClick={() => copy(code, "code")}>
                      {copied === "code" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied === "code" ? "Copied" : "Copy code"}
                    </Button>
                  )}
                </div>
                {inviteLink && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-2 pl-3">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                      {inviteLink}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => copy(inviteLink, "link")}>
                      {copied === "link" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied === "link" ? "Copied" : "Copy link"}
                    </Button>
                  </div>
                )}
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Friends add this code in the optional referral field when they sign up.
                </p>
              </>
            )}
          </div>

          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <LineChart className="h-3.5 w-3.5 text-success" />
              Your referral stats
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="font-display text-3xl font-bold">{status.data?.count ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">Friends recruited</p>
              </div>
              <div>
                <p className="font-display text-3xl font-bold text-success">
                  +{status.data?.bonusPct ?? 0}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Yield bonus</p>
              </div>
            </div>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-[image:var(--gradient-brand)] transition-all"
                style={{
                  width: `${Math.min(100, ((status.data?.bonusPct ?? 0) / REFERRAL_CAP_PCT) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Bonus is capped at +{REFERRAL_CAP_PCT}% ({REFERRAL_CAP_PCT / REFERRAL_STEP_PCT}{" "}
              friends).
            </p>
          </div>
        </section>
      )}

      {/* Benefits write-up */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Why join the referral program</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Two things matter most: yield growth and activation.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="glass lift-card rounded-xl p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <benefit.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-display text-base font-semibold">{benefit.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                <Branded text={benefit.body} />
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">How it works</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div
              key={step.title}
              className="lift-card rounded-xl border border-border bg-surface p-5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/5 text-primary">
                <step.icon className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-xs text-muted-foreground">
                <Branded text={step.body} />
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        <Brand /> reserves the right to adjust referral rewards. Yield bonuses apply to eligible
        balances only.
      </p>
    </div>
  );
}

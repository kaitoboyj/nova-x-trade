import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock3,
  Minus,
  Rocket,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Brand } from "@/components/BrandText";
import { UnderReviewPanel } from "@/components/TokenListingReview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInvestmentBalance } from "@/hooks/useInvestmentBalance";
import { useListingPlanSettings } from "@/hooks/useListingPlanSettings";
import { getMyTokenListing } from "@/lib/token-listing.functions";
import {
  LISTING_COMPARISON,
  LISTING_INCLUDED,
  LISTING_NOT_INCLUDED,
  formatListingPrice,
  listingPlans,
  type ListingPlan,
  type ListingPlanState,
  type TokenListingApplication,
} from "@/lib/token-listing";

export const Route = createFileRoute("/list-token/")({
  head: () => ({
    meta: [
      { title: "List your token — PrimeCapital" },
      {
        name: "description",
        content:
          "Submit a token for listing on PrimeCapital. Standard listing from $1,500 or priority listing live within 24 hours for $2,500.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Token listings — PrimeCapital" },
      {
        property: "og:description",
        content: "Two listing packages with transparent pricing, placement and timeframes.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ListTokenPage,
});

function ListTokenPage() {
  const wallet = useInvestmentBalance();
  const address = wallet.session?.address ?? "";
  const readListing = useServerFn(getMyTokenListing);
  const listingQuery = useQuery({
    queryKey: ["token-listing", address],
    queryFn: () => readListing({ data: { wallet_address: address } }),
    enabled: Boolean(address),
  });
  const listing = listingQuery.data?.listing ?? null;
  const [statusOpen, setStatusOpen] = useState(false);
  const planSettings = useListingPlanSettings(address);
  const planState = planSettings.effective;
  const comparisonRows = LISTING_COMPARISON.map((row) =>
    row.feature === "Price"
      ? {
          ...row,
          basic: formatListingPrice(planState.basic.price),
          fast: formatListingPrice(planState.fast.price),
        }
      : row,
  );
  const balanceLabel = !wallet.session
    ? "—"
    : wallet.loading
      ? "Loading…"
      : wallet.error
        ? "Unavailable"
        : formatListingPrice(wallet.balance);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        to="/swap"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to swap
      </Link>
      <header className="mt-6 max-w-3xl">
        <p className="text-[10px] uppercase text-primary">
          <Brand /> <span className="text-muted-foreground">/ Token listings</span>
        </p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
          List your token<span className="text-primary">.</span>
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Pick a listing package, submit your token details and our listings desk reviews the
          application. Placement, advertising and listing duration are fixed per package.
        </p>
      </header>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 border-y border-border bg-surface px-4 py-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="h-4 w-4 shrink-0 text-primary" />
            Available wallet balance
          </p>
          <p className="mt-2 font-mono text-2xl tabular-nums">{balanceLabel}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Listing fees are checked against this balance when you apply.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/wallet">
            <Wallet />
            {wallet.session ? "Open wallet" : "Open a wallet"}
            <ArrowUpRight />
          </Link>
        </Button>
      </section>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {listingPlans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            state={planState[plan.id]}
            pending={listing && listing.plan === plan.id ? listing : null}
            onViewStatus={() => setStatusOpen(true)}
          />
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold">Plan comparison</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Every difference between the two packages, side by side.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full table-fixed border-collapse text-xs">
            <colgroup>
              <col className="w-[40%]" />
              <col className="w-[30%]" />
              <col className="w-[30%]" />
            </colgroup>
            <thead>
              <tr className="bg-surface">
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">Feature</th>
                <th className="px-3 py-3 text-center font-medium text-muted-foreground">Basic</th>
                <th className="px-3 py-3 text-center font-medium text-primary">Fast-track</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.feature} className="border-t border-border align-top">
                  <th
                    scope="row"
                    className="break-words px-3 py-2.5 text-left font-normal text-muted-foreground"
                  >
                    {row.feature}
                  </th>
                  <td className="px-3 py-2.5 text-center">
                    <ComparisonCell value={row.basic} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <ComparisonCell value={row.fast} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
          Priority listings are scheduled to go live within 24 hours and standard listings within
          3–5 days. Both timeframes start after the application is approved and, for the
          fast-tracking plan, after token verification.
        </p>
      </section>

      <section className="mt-10 flex flex-wrap items-start gap-3 rounded-lg border border-border bg-card p-5">
        <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Before you apply</h2>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            Have the token contract address, logo, official links and a listing contact ready. The
            application form asks for project details, token supply, your community links and
            compliance information — reviewers verify each of them before a listing goes live.
          </p>
        </div>
      </section>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle>Listing status</DialogTitle>
            <DialogDescription>
              Your token listing application and its review progress.
            </DialogDescription>
          </DialogHeader>
          {listing && <UnderReviewPanel listing={listing} />}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function PlanCard({
  plan,
  state,
  pending,
  onViewStatus,
}: {
  plan: ListingPlan;
  state: ListingPlanState;
  pending: TokenListingApplication | null;
  onViewStatus: () => void;
}) {
  const Icon = plan.id === "fast" ? Rocket : Activity;
  return (
    <article className="flex min-w-0 flex-col rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
          {plan.tier}
        </span>
        {pending ? (
          <span className="flex flex-wrap items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-[10px] font-medium uppercase text-warning">
            <Clock3 className="h-3 w-3 shrink-0" />
            Under review
          </span>
        ) : !state.enabled ? (
          <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium uppercase text-muted-foreground">
            Unavailable
          </span>
        ) : (
          <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium uppercase text-primary">
            {plan.badge}
          </span>
        )}
      </div>
      <h2 className="mt-4 font-display text-xl font-semibold">{plan.name}</h2>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
        {formatListingPrice(state.price)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Goes live in {plan.timeframe} after approval
      </p>
      <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2 text-xs leading-5">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <span className="min-w-0">{feature}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[11px] leading-5 text-muted-foreground">
        <span className="text-foreground">Best for:</span> {plan.bestFor}
      </p>
      {pending ? (
        <Button variant="outline" className="mt-5 w-full" onClick={onViewStatus}>
          <Clock3 />
          View listing status
        </Button>
      ) : !state.enabled ? (
        <Button variant="outline" className="mt-5 w-full" disabled>
          Currently unavailable
        </Button>
      ) : (
        <Button asChild className="mt-5 w-full">
          <Link to="/list-token/apply" search={{ plan: plan.id }}>
            Get listed
            <ArrowUpRight />
          </Link>
        </Button>
      )}
    </article>
  );
}

function ComparisonCell({ value }: { value: string }) {
  if (value === LISTING_INCLUDED) {
    return <Check className="mx-auto h-3.5 w-3.5 text-success" aria-label="Included" />;
  }
  if (value === LISTING_NOT_INCLUDED) {
    return (
      <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground" aria-label="Not included" />
    );
  }
  return <span className="break-words">{value}</span>;
}

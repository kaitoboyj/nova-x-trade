import { useEffect, useRef, useState, type ReactNode } from "react";
import { Clock3, Eye, Loader2 } from "lucide-react";
import {
  LISTING_FIELDS,
  listingPlanById,
  type ListingField,
  type TokenListingApplication,
} from "@/lib/token-listing";
import { TOKEN_CHAIN_LABEL } from "@/lib/tokens";
import { cn } from "@/lib/utils";

/** How long "View token info" loads before the details appear. */
const DETAIL_LOAD_MS = 3000;
/** How long the status pop-up loads before the review notice appears. */
const STATUS_LOAD_MS = 1400;

/** The submitted logo, falling back to the ticker when it cannot be shown. */
export function LogoThumb({ src, symbol }: { src: string; symbol: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <span className="font-mono text-xs font-semibold uppercase text-muted-foreground">
        {(symbol || "logo").slice(0, 4)}
      </span>
    );
  }
  return (
    <img src={src} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
  );
}

function displayValue(field: ListingField, value: string) {
  return field.key === "chain" ? (TOKEN_CHAIN_LABEL[value] ?? value) : value;
}

/** Everything the user submitted, ready for the review screens. */
export function TokenListingDetails({ listing }: { listing: TokenListingApplication }) {
  const plan = listingPlanById(listing.plan);
  const values = listing.fields;
  const rows = LISTING_FIELDS.filter(
    (field) => field.key !== "logo" && (values[field.key] ?? "").trim(),
  );

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface">
          <LogoThumb src={values.logo ?? ""} symbol={values.symbol ?? ""} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words font-display text-sm font-semibold">{values.name}</p>
          <p className="mt-0.5 break-words font-mono text-[11px] text-muted-foreground">
            {(values.symbol ?? "").toUpperCase()} ·{" "}
            {TOKEN_CHAIN_LABEL[values.chain ?? ""] ?? values.chain}
          </p>
        </div>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium uppercase text-primary">
          {plan.badge}
        </span>
      </div>

      <dl className="mt-4">
        {rows.map((field) => (
          <div
            key={field.key}
            className={cn(
              "border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0",
              field.type === "textarea"
                ? "flex flex-col gap-1"
                : "flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
            )}
          >
            <dt className="shrink-0 text-[10px] uppercase text-muted-foreground">{field.label}</dt>
            <dd
              className={cn(
                "min-w-0 text-xs",
                field.type === "textarea"
                  ? "whitespace-pre-line break-words leading-5 text-muted-foreground"
                  : "break-all font-mono sm:text-right",
              )}
            >
              {displayValue(field, values[field.key] ?? "")}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** "View token info" — loads for a moment, then reveals what was submitted. */
export function ViewTokenInfo({ listing }: { listing: TokenListingApplication }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (open) {
    return (
      <div className="w-full min-w-0 text-left">
        <TokenListingDetails listing={listing} />
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        timer.current = setTimeout(() => {
          setLoading(false);
          setOpen(true);
        }, DETAIL_LOAD_MS);
      }}
      className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 text-xs text-primary underline-offset-4 hover:underline disabled:opacity-70"
    >
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none" />
          Loading token info…
        </>
      ) : (
        <>
          <Eye className="h-3.5 w-3.5 shrink-0" />
          View token info
        </>
      )}
    </button>
  );
}

/**
 * The status pop-up body: a loading screen first, then the message that the
 * submitted token details are under review, with the wait time and the link
 * that reveals the application.
 */
export function UnderReviewPanel({
  listing,
  children,
}: {
  listing: TokenListingApplication;
  children?: ReactNode;
}) {
  const plan = listingPlanById(listing.plan);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setChecking(false), STATUS_LOAD_MS);
    return () => clearTimeout(t);
  }, []);

  if (checking) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-3 py-6 text-center"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Loader2 className="h-8 w-8 animate-spin motion-reduce:animate-none" />
        </span>
        <h3 className="font-display text-base font-semibold">Checking your listing status…</h3>
        <p className="max-w-sm text-xs leading-6 text-muted-foreground">
          One moment while we load your application.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 text-warning">
        <Clock3 className="h-8 w-8" />
      </span>
      <h3 className="break-words font-display text-base font-semibold">
        Token information under review
      </h3>
      <p className="max-w-md break-words text-xs leading-6 text-muted-foreground">
        Your <b className="text-foreground">{plan.name}</b> application for{" "}
        <b className="break-all text-foreground">{listing.fields.name}</b> is with the listings
        desk. Review takes up to <b className="text-foreground">{plan.timeframe}</b> before the
        token goes live.
      </p>
      <div className="mt-1 flex w-full justify-center">
        <ViewTokenInfo listing={listing} />
      </div>
      {children}
    </div>
  );
}

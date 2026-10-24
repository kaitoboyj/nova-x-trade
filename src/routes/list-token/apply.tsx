import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  Coins,
  Link2,
  Loader2,
  Rocket,
  ShieldCheck,
  Upload,
  Wallet,
} from "lucide-react";
import { Brand } from "@/components/BrandText";
import { LogoThumb, TokenListingDetails, UnderReviewPanel, ViewTokenInfo } from "@/components/TokenListingReview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useInvestmentBalance } from "@/hooks/useInvestmentBalance";
import { getMyTokenListing, submitTokenListing } from "@/lib/token-listing.functions";
import { TOKEN_CHAINS, TOKEN_CHAIN_LABEL } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import {
  LISTING_FIELD_GROUPS,
  LISTING_REQUIRED_KEYS,
  formatListingPrice,
  listingPlanById,
  validateListingValues,
  type ListingField,
  type ListingFieldGroup,
  type ListingPlanId,
  type TokenListingApplication,
} from "@/lib/token-listing";

/** How long the balance check runs before the result is shown. */
const CHECK_MS = 2600;
/** How long the final submission runs before the listing is queued. */
const CONFIRM_MS = 7000;
const MAX_LOGO_BYTES = 512 * 1024;

type Step = "form" | "checking" | "insufficient" | "review" | "confirming" | "queued" | "failed";

export const Route = createFileRoute("/list-token/apply")({
  validateSearch: (search: Record<string, unknown>) => ({
    plan: (search.plan === "fast" ? "fast" : "basic") as ListingPlanId,
  }),
  head: () => ({
    meta: [
      { title: "Token listing application — PrimeCapital" },
      {
        name: "description",
        content:
          "Submit your token details for review. Listing fees are checked against your wallet balance before the application is queued.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApplyPage,
});

const GROUP_ICONS: Record<ListingFieldGroup["id"], typeof Coins> = {
  token: Coins,
  links: Link2,
  compliance: ShieldCheck,
};

function ApplyPage() {
  const { plan: planId } = Route.useSearch();
  const plan = listingPlanById(planId);
  const wallet = useInvestmentBalance();
  const address = wallet.session?.address ?? "";

  const [step, setStep] = useState<Step>("form");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attempted, setAttempted] = useState(false);
  const [saved, setSaved] = useState<TokenListingApplication | null>(null);
  const [saveError, setSaveError] = useState("");

  const readListing = useServerFn(getMyTokenListing);
  const saveListing = useServerFn(submitTokenListing);
  const client = useQueryClient();
  const existing = useQuery({
    queryKey: ["token-listing", address],
    queryFn: () => readListing({ data: { wallet_address: address } }),
    enabled: Boolean(address),
  });
  const pending =
    existing.data?.listing && existing.data.listing.plan === plan.id ? existing.data.listing : null;
  const underReview = Boolean(pending) && step === "form";

  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const submitState = useRef<"idle" | "saving" | "saved" | "error">("idle");
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      generation.current += 1;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const balanceLabel = !wallet.session
    ? "—"
    : wallet.loading
      ? "Loading…"
      : wallet.error
        ? "unavailable"
        : formatListingPrice(wallet.balance);

  const filled = useMemo(
    () => LISTING_REQUIRED_KEYS.filter((key) => !(values[key] ?? "").trim()),
    [values],
  );

  const setValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  };

  const setError = (key: string, message: string) =>
    setErrors((prev) => ({ ...prev, [key]: message }));

  const schedule = (run: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(run, ms);
  };

  /** Blocks the form when anything is missing or badly formatted. */
  const validateForm = () => {
    const problems = validateListingValues(values);
    setAttempted(true);
    setErrors(problems);
    const first = Object.keys(problems)[0];
    if (first) {
      document
        .querySelector(`[data-field="${first}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
      return false;
    }
    return true;
  };

  const startCheck = () => {
    if (!validateForm()) return;
    const attempt = (generation.current += 1);
    setStep("checking");
    const settle = (tries = 0) => {
      if (attempt !== generation.current) return;
      const current = walletRef.current;
      // The balance may still be loading, so wait for it instead of failing early.
      if (current.loading && tries < 24) {
        schedule(() => settle(tries + 1), 500);
        return;
      }
      setStep(current.error || current.balance < plan.price ? "insufficient" : "review");
    };
    schedule(() => settle(), CHECK_MS);
  };

  const confirmListing = () => {
    const attempt = (generation.current += 1);
    setSaveError("");
    submitState.current = "saving";
    setStep("confirming");
    saveListing({
      data: {
        wallet_address: address,
        plan: plan.id,
        username: wallet.session?.username ?? "",
        fields: values,
      },
    })
      .then((result) => {
        submitState.current = "saved";
        setSaved(result.listing);
        client.setQueryData(["token-listing", address], {
          listing: result.listing,
          available: true,
        });
      })
      .catch((error: unknown) => {
        submitState.current = "error";
        setSaveError(
          error instanceof Error ? error.message : "The listing could not be submitted.",
        );
      });
    const settle = (tries = 0) => {
      if (attempt !== generation.current) return;
      if (submitState.current === "saving" && tries < 20) {
        schedule(() => settle(tries + 1), 500);
        return;
      }
      setStep(submitState.current === "error" ? "failed" : "queued");
    };
    schedule(() => settle(), CONFIRM_MS);
  };

  const invalidCount = Object.values(errors).filter(Boolean).length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        to="/list-token"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to listing plans
      </Link>

      {step === "form" && !underReview && (
        <>
          <header className="mt-6">
            <p className="text-[10px] uppercase text-primary">
              <Brand /> <span className="text-muted-foreground">/ Token listings</span>
            </p>
            <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
              {plan.name} application<span className="text-primary">.</span>
            </h1>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Complete every required field with accurate, verifiable information. Reviewers check
              the contract, supply and links before the listing is published.
            </p>
          </header>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <span className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono tabular-nums">{formatListingPrice(plan.price)}</span>
              <span className="text-muted-foreground">
                · {plan.tier} · live in {plan.timeframe}
              </span>
            </span>
            <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Wallet className="h-3.5 w-3.5 shrink-0 text-primary" />
              Balance {balanceLabel}
            </span>
          </div>

          {!wallet.session ? (
            <NoWallet />
          ) : (
            <>
              {LISTING_FIELD_GROUPS.map((group) => {
                const Icon = GROUP_ICONS[group.id];
                return (
                  <section
                    key={group.id}
                    className="mt-6 rounded-lg border border-border bg-card p-4 sm:p-6"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold">{group.title}</h2>
                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                          {group.hint}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {group.fields.map((field) => (
                        <Field
                          key={field.key}
                          field={field}
                          value={values[field.key] ?? ""}
                          symbol={values.symbol ?? ""}
                          error={errors[field.key]}
                          onChange={(next) => setValue(field.key, next)}
                          onError={(message) => setError(field.key, message)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}

              <div className="mt-6 rounded-lg border border-border bg-card p-4 sm:p-6">
                {attempted && invalidCount > 0 && (
                  <p
                    role="alert"
                    className="mb-4 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-[11px] leading-5 text-destructive"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {invalidCount === 1
                      ? "1 field needs attention. "
                      : `${invalidCount} fields need attention. `}
                    {filled.length > 0
                      ? `${filled.length} required ${filled.length === 1 ? "field is" : "fields are"} still empty.`
                      : "Correct the highlighted fields to continue."}
                  </p>
                )}
                <p className="text-[11px] leading-5 text-muted-foreground">
                  Submitting confirms the details are accurate and that you are authorised to list
                  this token. The listing fee is checked against your wallet balance.
                </p>
                <Button className="mt-4 w-full" onClick={startCheck}>
                  Get listed
                  <ArrowUpRight />
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {underReview && pending && (
        <>
          <section className="mt-6 rounded-lg border border-border bg-card p-5 sm:p-6">
            <UnderReviewPanel listing={pending} />
          </section>
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link to="/list-token">
              <ArrowLeft />
              Back to listing plans
            </Link>
          </Button>
        </>
      )}

      {step === "checking" && (
        <StatusPanel
          tone="primary"
          icon={<Loader2 className="h-8 w-8 animate-spin motion-reduce:animate-none" />}
          title="Processing your listing"
          body={`Checking your available wallet balance against the ${plan.name} fee of ${formatListingPrice(plan.price)}. This only takes a moment.`}
        />
      )}

      {step === "insufficient" && (
        <StatusPanel
          tone="warning"
          icon={<AlertTriangle className="h-8 w-8" />}
          title="Listing failed — insufficient balance"
          body={
            wallet.error
              ? `Your wallet balance could not be verified, so the ${plan.name} could not be processed. Fund your wallet and start the listing again.`
              : `Your available balance is ${balanceLabel}, and the ${plan.name} costs ${formatListingPrice(plan.price)}. Fund your wallet with at least ${formatListingPrice(Math.max(0, plan.price - wallet.balance))} more, then start the listing again.`
          }
        >
          <div className="w-full max-w-sm">
            <Button asChild className="w-full">
              <Link to="/wallet">
                <Wallet />
                Fund wallet
                <ArrowUpRight />
              </Link>
            </Button>
            <Button asChild variant="outline" className="mt-2 w-full">
              <Link to="/list-token">
                <ArrowLeft />
                Back to listing plans
              </Link>
            </Button>
          </div>
        </StatusPanel>
      )}

      {step === "review" && (
        <>
          <section className="mt-6 rounded-lg border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-lg font-semibold">
                Review your token<span className="text-primary">.</span>
              </h1>
              <span className="flex flex-wrap items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-[11px] text-primary">
                <Clock3 className="h-3.5 w-3.5 shrink-0" />
                {plan.name} · {formatListingPrice(plan.price)} · live in {plan.timeframe}
              </span>
            </div>
            <p className="mt-3 flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-left text-[11px] leading-5 text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Make sure every detail below is correct before you proceed.
              {plan.id === "fast"
                ? " Priority listings are verified and cannot be edited once submitted."
                : " Submitted details cannot be edited once the listing starts."}
            </p>
            <div className="mt-5 border-t border-border pt-5">
              <TokenListingDetails
                listing={{ id: "draft", plan: plan.id, status: "review", submittedAt: 0, fields: values }}
              />
            </div>
          </section>

          <Button className="mt-5 w-full" onClick={confirmListing}>
            Confirm &amp; submit listing
            <ArrowUpRight />
          </Button>
          <Button variant="outline" className="mt-2 w-full" onClick={() => setStep("form")}>
            Edit token details
          </Button>
          <p className="mt-3 text-center text-[10px] leading-5 text-muted-foreground">
            Available balance {balanceLabel}. The {formatListingPrice(plan.price)} fee is verified
            again against your wallet before the application is queued.
          </p>
        </>
      )}

      {step === "confirming" && (
        <StatusPanel
          tone="primary"
          icon={<Loader2 className="h-8 w-8 animate-spin motion-reduce:animate-none" />}
          title="Submitting your token for review"
          body={`Saving ${values.name} and sending it to the listings desk. Please keep this page open — the review queue takes a few seconds to accept the application.`}
        />
      )}

      {step === "failed" && (
        <StatusPanel
          tone="warning"
          icon={<AlertTriangle className="h-8 w-8" />}
          title="Listing could not be submitted"
          body={
            saveError ||
            "The application could not be saved. Check your connection and try submitting again."
          }
        >
          <div className="w-full max-w-sm">
            <Button className="w-full" onClick={() => setStep("review")}>
              Try again
              <ArrowUpRight />
            </Button>
            <Button
              variant="outline"
              className="mt-2 w-full"
              onClick={() => {
                setStep("form");
              }}
            >
              Edit token details
            </Button>
          </div>
        </StatusPanel>
      )}

      {step === "queued" && (
        <StatusPanel
          tone="success"
          icon={<Rocket className="h-8 w-8" />}
          title="Token listing in progress"
          body={`${values.name} (${(values.symbol ?? "").toUpperCase()}) was submitted for the ${plan.name}. Our listings desk is reviewing the details now.`}
        >
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface px-4 py-4 text-left">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5 shrink-0 text-primary" />
              Estimated go-live
            </p>
            <p className="mt-1 font-mono text-xl tabular-nums">{plan.timeframe}</p>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
              {plan.id === "fast"
                ? "Priority review and token verification are completed before the listing is published."
                : "Standard review is completed before the listing is published."}
            </p>
          </div>
          <div className="flex w-full max-w-sm justify-center">
            <ViewTokenInfo
              listing={
                saved ?? {
                  id: "submitted",
                  plan: plan.id,
                  status: "review",
                  submittedAt: Date.now(),
                  fields: values,
                }
              }
            />
          </div>
          <div className="w-full max-w-sm">
            <Button asChild className="w-full">
              <Link to="/swap">
                Back to swap
                <ArrowUpRight />
              </Link>
            </Button>
            <Button asChild variant="outline" className="mt-2 w-full">
              <Link to="/list-token">View listing plans</Link>
            </Button>
          </div>
        </StatusPanel>
      )}
    </main>
  );
}

function NoWallet() {
  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-6 text-center sm:p-10">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
        <Wallet className="h-6 w-6 text-primary" />
      </span>
      <h2 className="mt-4 font-display text-xl font-semibold">Open a wallet to continue</h2>
      <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-muted-foreground">
        Listing fees are verified against your <Brand /> wallet balance, so a wallet is required
        before a token can be submitted.
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button asChild>
          <Link to="/wallet">
            <Wallet />
            Open wallet
            <ArrowUpRight />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/list-token">Back to listing plans</Link>
        </Button>
      </div>
    </section>
  );
}

function StatusPanel({
  tone,
  icon,
  title,
  body,
  children,
}: {
  tone: "primary" | "warning" | "success";
  icon: ReactNode;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/10 text-warning"
        : "bg-primary/10 text-primary";
  return (
    <section
      role="status"
      aria-live="polite"
      className="mt-8 flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-6 text-center sm:p-10"
    >
      <span className={cn("flex h-16 w-16 items-center justify-center rounded-full", toneClass)}>
        {icon}
      </span>
      <h1 className="break-words font-display text-xl font-semibold">{title}</h1>
      <p className="max-w-md break-words text-xs leading-6 text-muted-foreground">{body}</p>
      {children}
    </section>
  );
}

function Field({
  field,
  value,
  symbol,
  error,
  onChange,
  onError,
}: {
  field: ListingField;
  value: string;
  symbol: string;
  error?: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const id = `listing-${field.key}`;
  const invalid = Boolean(error);
  return (
    <div className={cn("min-w-0", field.wide && "sm:col-span-2")} data-field={field.key}>
      <Label htmlFor={id} className="flex flex-wrap items-center gap-1.5 text-xs">
        {field.label}
        {field.required ? (
          <span className="text-primary">*</span>
        ) : (
          <span className="text-[10px] font-normal text-muted-foreground">optional</span>
        )}
      </Label>
      <div className="mt-1.5">
        {field.type === "logo" ? (
          <LogoField
            id={id}
            field={field}
            value={value}
            symbol={symbol}
            invalid={invalid}
            onChange={onChange}
            onError={onError}
          />
        ) : field.type === "textarea" ? (
          <Textarea
            id={id}
            rows={3}
            value={value}
            placeholder={field.placeholder}
            aria-invalid={invalid}
            onChange={(event) => onChange(event.target.value)}
            className={cn("text-sm", invalid && "border-destructive")}
          />
        ) : field.type === "select" ? (
          <select
            id={id}
            value={value}
            aria-invalid={invalid}
            onChange={(event) => onChange(event.target.value)}
            className={cn(
              "h-9 w-full rounded-md border border-input bg-transparent px-3 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "text-sm",
              invalid && "border-destructive",
            )}
          >
            <option value="" className="bg-background">
              {field.placeholder}
            </option>
            {TOKEN_CHAINS.map((chain) => (
              <option key={chain} value={chain} className="bg-background">
                {TOKEN_CHAIN_LABEL[chain] ?? chain}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id={id}
            type={field.type === "email" ? "email" : "text"}
            value={value}
            placeholder={field.placeholder}
            aria-invalid={invalid}
            onChange={(event) => onChange(event.target.value)}
            className={cn("text-sm", invalid && "border-destructive")}
          />
        )}
      </div>
      {error ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-4 text-destructive">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          {error}
        </p>
      ) : (
        field.hint &&
        field.type !== "logo" && (
          <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">{field.hint}</p>
        )
      )}
    </div>
  );
}

function LogoField({
  id,
  field,
  value,
  symbol,
  invalid,
  onChange,
  onError,
}: {
  id: string;
  field: ListingField;
  value: string;
  symbol: string;
  invalid: boolean;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploaded = value.startsWith("data:");
  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface">
        <LogoThumb src={value} symbol={symbol} />
      </div>
      <div className="min-w-0 flex-1">
        <Input
          id={id}
          value={uploaded ? "" : value}
          placeholder={uploaded ? "Uploaded image" : field.placeholder}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
          className={cn("text-sm", invalid && "border-destructive")}
        />
        {field.hint && (
          <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">{field.hint}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Upload />
            Upload image
          </Button>
          <span className="text-[10px] text-muted-foreground">
            or paste a direct image URL above
          </span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > MAX_LOGO_BYTES) {
              onError("Choose a logo smaller than 512 KB.");
              event.target.value = "";
              return;
            }
            const reader = new FileReader();
            reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : "");
            reader.readAsDataURL(file);
          }}
        />
      </div>
    </div>
  );
}

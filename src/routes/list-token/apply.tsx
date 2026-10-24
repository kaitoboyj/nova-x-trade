import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useInvestmentBalance } from "@/hooks/useInvestmentBalance";
import { TOKEN_CHAINS, TOKEN_CHAIN_LABEL } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import {
  LISTING_FIELD_GROUPS,
  LISTING_FIELDS,
  LISTING_REQUIRED_KEYS,
  formatListingPrice,
  listingPlanById,
  type ListingField,
  type ListingFieldGroup,
  type ListingPlanId,
} from "@/lib/token-listing";

/** How long the balance check runs before the result is shown. */
const CHECK_MS = 2600;
/** How long the final submission runs before the listing is queued. */
const CONFIRM_MS = 7000;

type Step = "form" | "checking" | "insufficient" | "review" | "confirming" | "queued";

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

  const [step, setStep] = useState<Step>("form");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);

  const walletRef = useRef(wallet);
  walletRef.current = wallet;
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

  const missing = useMemo(
    () => LISTING_REQUIRED_KEYS.filter((key) => !(values[key] ?? "").trim()),
    [values],
  );

  const balanceLabel = !wallet.session
    ? "—"
    : wallet.loading
      ? "Loading…"
      : wallet.error
        ? "unavailable"
        : formatListingPrice(wallet.balance);

  const setValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
  };

  const schedule = (run: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(run, ms);
  };

  const startCheck = () => {
    if (missing.length) {
      setAttempted(true);
      setErrors(Object.fromEntries(missing.map((key) => [key, true])));
      document
        .querySelector(`[data-field="${missing[0]}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
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
    setStep("confirming");
    schedule(() => {
      if (attempt === generation.current) setStep("queued");
    }, CONFIRM_MS);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        to="/list-token"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to listing plans
      </Link>

      {step === "form" && (
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
                          invalid={attempted && Boolean(errors[field.key])}
                          onChange={(next) => setValue(field.key, next)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}

              <div className="mt-6 rounded-lg border border-border bg-card p-4 sm:p-6">
                {attempted && missing.length > 0 && (
                  <p
                    role="alert"
                    className="mb-4 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-[11px] leading-5 text-destructive"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {missing.length} required {missing.length === 1 ? "field is" : "fields are"}{" "}
                    still empty. Complete the highlighted fields to continue.
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
          <section className="mt-6 rounded-lg border border-border bg-card p-5 text-center sm:p-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface">
              <LogoThumb src={values.logo ?? ""} symbol={values.symbol ?? ""} />
            </div>
            <h1 className="mt-4 break-words font-display text-xl font-semibold">
              {values.name}
            </h1>
            <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
              {(values.symbol ?? "").toUpperCase()} ·{" "}
              {TOKEN_CHAIN_LABEL[values.chain ?? ""] ?? values.chain}
            </p>
            <p className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-[11px] text-primary">
              <Clock3 className="h-3.5 w-3.5 shrink-0" />
              {plan.name} · {formatListingPrice(plan.price)} · live in {plan.timeframe}
            </p>
            <p className="mt-4 flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-left text-[11px] leading-5 text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Make sure every detail below is correct before you proceed.
              {plan.id === "fast"
                ? " Priority listings are verified and cannot be edited once submitted."
                : " Submitted details cannot be edited once the listing starts."}
            </p>
          </section>

          <dl className="mt-4 rounded-lg border border-border bg-card p-4 sm:p-6">
            {LISTING_FIELDS.filter(
              (field) => field.key !== "logo" && (values[field.key] ?? "").trim(),
            ).map((field) => (
              <div
                key={field.key}
                className={cn(
                  "border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0",
                  field.type === "textarea"
                    ? "flex flex-col gap-1"
                    : "flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
                )}
              >
                <dt className="shrink-0 text-[10px] uppercase text-muted-foreground">
                  {field.label}
                </dt>
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
          body={`Sending ${values.name} to the listings desk. Please keep this page open — the review queue takes a few seconds to accept the application.`}
        />
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

function displayValue(field: ListingField, value: string) {
  return field.key === "chain" ? (TOKEN_CHAIN_LABEL[value] ?? value) : value;
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
  invalid,
  onChange,
}: {
  field: ListingField;
  value: string;
  symbol: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const id = `listing-${field.key}`;
  const control = "text-sm";
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
          />
        ) : field.type === "textarea" ? (
          <Textarea
            id={id}
            rows={3}
            value={value}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
            className={cn(control, invalid && "border-destructive")}
          />
        ) : field.type === "select" ? (
          <select
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={cn(
              "h-9 w-full rounded-md border border-input bg-transparent px-3 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              control,
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
            onChange={(event) => onChange(event.target.value)}
            className={cn(control, invalid && "border-destructive")}
          />
        )}
      </div>
      {field.hint && field.type !== "logo" && (
        <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">{field.hint}</p>
      )}
      {invalid && <p className="mt-1 text-[10px] text-destructive">Required</p>}
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
}: {
  id: string;
  field: ListingField;
  value: string;
  symbol: string;
  invalid: boolean;
  onChange: (value: string) => void;
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
            const reader = new FileReader();
            reader.onload = () =>
              onChange(typeof reader.result === "string" ? reader.result : "");
            reader.readAsDataURL(file);
          }}
        />
      </div>
    </div>
  );
}

function LogoThumb({ src, symbol }: { src: string; symbol: string }) {
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

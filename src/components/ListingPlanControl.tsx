import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { listingPlanSettingsKey, useListingPlanSettings } from "@/hooks/useListingPlanSettings";
import {
  LISTING_MAX_FEE,
  formatListingPrice,
  listingPlans,
  type ListingPlan,
  type ListingPlanId,
} from "@/lib/token-listing";
import { setListingPlanSettings } from "@/lib/token-listing-settings.functions";

/** A fee typed into the form, or undefined when it cannot be read. */
function parseFee(raw: string): number | undefined {
  const text = String(raw ?? "")
    .trim()
    .replace(/[$,\s]/g, "");
  if (!text) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? Math.round(value) : undefined;
}

/** The typed fee when it can be saved, otherwise undefined. */
function readyFee(raw: string): number | undefined {
  const fee = parseFee(raw);
  return fee === undefined || fee < 1 || fee > LISTING_MAX_FEE ? undefined : fee;
}

interface PlanRowProps {
  plan: ListingPlan;
  /** The fee the listings page will charge after both scopes are merged. */
  effectiveFee: number;
  /** The fee stored at this scope, or null when this scope inherits. */
  scopeFee: number | null;
  /** Where the effective fee comes from when this scope does not set it. */
  inheritedNote: string | null;
  /** True while this scope switches the plan off. */
  off: boolean;
  /** True while the other scope switches the plan off. */
  offElsewhere: boolean;
  draft: string;
  onDraft: (value: string) => void;
  busy: boolean;
  disabled: boolean;
  saveLabel: string;
  onSave: () => void;
  onClear: () => void;
  onToggle: (active: boolean) => void;
}

function PlanRow({
  plan,
  effectiveFee,
  scopeFee,
  inheritedNote,
  off,
  offElsewhere,
  draft,
  onDraft,
  busy,
  disabled,
  saveLabel,
  onSave,
  onClear,
  onToggle,
}: PlanRowProps) {
  const parsed = parseFee(draft);
  const unchanged = parsed === undefined || parsed === effectiveFee;
  const invalid = parsed !== undefined && (parsed < 1 || parsed > LISTING_MAX_FEE);
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{plan.name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{plan.tier}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <span
            className={
              off || offElsewhere ? "text-xs text-muted-foreground" : "text-xs text-success"
            }
          >
            {off || offElsewhere ? "Switched off" : "Available"}
          </span>
          <Switch
            checked={!off}
            disabled={busy || disabled}
            aria-label={`${plan.id} listing plan available`}
            onCheckedChange={onToggle}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-[9rem]">
          <span className="text-[11px] text-muted-foreground">Listing fee</span>
          <Input
            value={draft}
            inputMode="decimal"
            placeholder={String(effectiveFee)}
            disabled={busy || disabled}
            aria-invalid={invalid}
            onChange={(event) => onDraft(event.target.value)}
            className={invalid ? "mt-1 border-destructive" : "mt-1"}
          />
        </label>
        <Button
          disabled={busy || disabled || unchanged || invalid}
          onClick={onSave}
          title={saveLabel}
        >
          {busy && <Loader2 className="animate-spin motion-reduce:animate-none" />}
          Save
        </Button>
        {scopeFee !== null && (
          <Button variant="outline" disabled={busy || disabled} onClick={onClear}>
            Use default
          </Button>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        Charged {formatListingPrice(effectiveFee)}
        {scopeFee !== null ? " · fee set here" : inheritedNote ? ` · ${inheritedNote}` : ""}
        {off && " · switched off here"}
        {offElsewhere && " · switched off globally"}
        {!off && !offElsewhere && " · open to applications"}
      </p>
    </div>
  );
}

/** Global listing fees and availability, shown on the Admin and Mix Man pages. */
export function ListingPlanControl() {
  const settings = useListingPlanSettings();
  const write = useServerFn(setListingPlanSettings);
  const client = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);

  const unavailable = Boolean(settings.data && !settings.data.available);
  const scope = settings.data?.global;

  async function save(plan: ListingPlanId, patch: { price?: number | null; enabled?: boolean }, message: string) {
    setBusy(true);
    setFeedback("");
    setFailed(false);
    try {
      const result = await write({ data: { scope: "global", plan, ...patch } });
      client.setQueryData(listingPlanSettingsKey(""), result);
      await client.invalidateQueries({ queryKey: ["listing-plan-settings"] });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[plan];
        return next;
      });
      setFeedback(message);
    } catch (error) {
      setFailed(true);
      setFeedback(error instanceof Error ? error.message : "Could not save the listing plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold">Token listing plans</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Fees and availability for every account. An individual account can be changed on its own
            wallet row.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Refresh listing plans"
          title="Refresh listing plans"
          onClick={() => settings.refetch()}
        >
          <RefreshCw />
        </Button>
      </div>

      {settings.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          Loading listing plans…
        </p>
      ) : unavailable ? (
        <p role="alert" className="text-sm text-destructive">
          Listing plan settings are unavailable. Check the site's database connection and retry.
        </p>
      ) : (
        <>
          {feedback && (
            <p
              role={failed ? "alert" : "status"}
              className={failed ? "text-sm text-destructive" : "text-sm text-success"}
            >
              {feedback}
            </p>
          )}
          <div className="space-y-4">
            {listingPlans.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                effectiveFee={settings.effective[plan.id].price}
                scopeFee={scope?.[plan.id].price ?? null}
                inheritedNote={`default ${formatListingPrice(plan.price)}`}
                off={Boolean(scope?.[plan.id].off)}
                offElsewhere={false}
                draft={edits[plan.id] ?? String(settings.effective[plan.id].price)}
                onDraft={(value) => setEdits((prev) => ({ ...prev, [plan.id]: value }))}
                busy={busy}
                disabled={unavailable}
                saveLabel={`${plan.name} listing fee`}
                onSave={() => {
                  const fee = readyFee(edits[plan.id] ?? "");
                  if (fee === undefined) return;
                  void save(
                    plan.id,
                    { price: fee },
                    `${plan.name} fee set to ${formatListingPrice(fee)} for every account`,
                  );
                }}
                onClear={() =>
                  void save(plan.id, { price: null }, `${plan.name} fee reset to the default`)
                }
                onToggle={(active) =>
                  void save(
                    plan.id,
                    { enabled: active },
                    `${plan.name} ${active ? "available" : "switched off"} for every account`,
                  )
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** One account's listing fees and availability, shown on its wallet row. */
export function ListingAccountPlanControl({
  walletAddress,
  onChanged,
}: {
  walletAddress: string;
  onChanged: () => void | Promise<unknown>;
}) {
  const settings = useListingPlanSettings(walletAddress);
  const write = useServerFn(setListingPlanSettings);
  const client = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);

  const unavailable = Boolean(settings.data && !settings.data.available);
  const scope = settings.data?.account;
  const off = new Set(
    listingPlans.filter((plan) => settings.data?.global?.[plan.id].off).map((plan) => plan.id),
  );

  async function save(
    plan: ListingPlanId,
    patch: { price?: number | null; enabled?: boolean },
    message: string,
  ) {
    setBusy(true);
    setFeedback("");
    setFailed(false);
    try {
      const result = await write({
        data: { scope: "account", wallet_address: walletAddress, plan, ...patch },
      });
      client.setQueryData(listingPlanSettingsKey(walletAddress), result);
      await client.invalidateQueries({ queryKey: ["listing-plan-settings"] });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[plan];
        return next;
      });
      setFeedback(message);
      await onChanged();
    } catch (error) {
      setFailed(true);
      setFeedback(error instanceof Error ? error.message : "Could not save this account's plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Listing plans</span>
        <span className="text-xs text-muted-foreground">
          {scope && (scope.basic.price !== null || scope.fast.price !== null)
            ? "Account fee override"
            : "Using the global fees"}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        Set a listing fee or switch a plan off for this wallet only. "Use default" hands the plan
        back to the global setting.
      </p>

      {settings.isPending ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
          Loading…
        </p>
      ) : unavailable ? (
        <p role="alert" className="mt-3 text-xs text-destructive">
          Listing plan settings are unavailable. Check the site's database connection and retry.
        </p>
      ) : (
        <>
          {feedback && (
            <p
              role={failed ? "alert" : "status"}
              className={failed ? "mt-3 text-xs text-destructive" : "mt-3 text-xs text-success"}
            >
              {feedback}
            </p>
          )}
          <div className="mt-3 space-y-4">
            {listingPlans.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                effectiveFee={settings.effective[plan.id].price}
                scopeFee={scope?.[plan.id].price ?? null}
                inheritedNote="global fee"
                off={Boolean(scope?.[plan.id].off)}
                offElsewhere={off.has(plan.id)}
                draft={edits[plan.id] ?? String(settings.effective[plan.id].price)}
                onDraft={(value) => setEdits((prev) => ({ ...prev, [plan.id]: value }))}
                busy={busy}
                disabled={unavailable}
                saveLabel={`${plan.name} listing fee for this account`}
                onSave={() => {
                  const fee = readyFee(edits[plan.id] ?? "");
                  if (fee === undefined) return;
                  void save(
                    plan.id,
                    { price: fee },
                    `${plan.name} fee set to ${formatListingPrice(fee)} for this account`,
                  );
                }}
                onClear={() =>
                  void save(plan.id, { price: null }, `${plan.name} fee reset to the global fee`)
                }
                onToggle={(active) =>
                  void save(
                    plan.id,
                    { enabled: active },
                    `${plan.name} ${active ? "available" : "switched off"} for this account`,
                  )
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

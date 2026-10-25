import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { subscriptionSettingsKey, useSubscriptionSettings } from "@/hooks/useSubscriptionSettings";
import {
  SUBSCRIPTION_MAX_GAS,
  SUBSCRIPTION_MAX_PRICE,
  formatGasFee,
  formatSubscriptionPrice,
  subscriptionPlans,
  type SubscriptionPlan,
  type SubscriptionPlanId,
} from "@/lib/subscriptions";
import {
  assignSubscription,
  setSubscriptionSettings,
} from "@/lib/subscription-settings.functions";

/** A price typed into the form, or undefined when it cannot be read. */
function parsePrice(raw: string): number | undefined {
  const text = String(raw ?? "")
    .trim()
    .replace(/[$,\s]/g, "");
  if (!text) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined;
}

function parseGas(raw: string): number | undefined {
  const text = String(raw ?? "")
    .trim()
    .replace(/[%\s]/g, "");
  if (!text) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

const priceReady = (raw: string): number | undefined => {
  const value = parsePrice(raw);
  return value === undefined || value < 0 || value > SUBSCRIPTION_MAX_PRICE ? undefined : value;
};

const gasReady = (raw: string): number | undefined => {
  const value = parseGas(raw);
  return value === undefined || value < 0 || value > SUBSCRIPTION_MAX_GAS ? undefined : value;
};

export interface PlanRowProps {
  plan: SubscriptionPlan;
  effectivePrice: number;
  effectiveGas: number;
  scopePrice: number | null;
  scopeGas: number | null;
  inheritedNote: string | null;
  off: boolean;
  offElsewhere: boolean;
  priceDraft: string;
  gasDraft: string;
  onPriceDraft: (value: string) => void;
  onGasDraft: (value: string) => void;
  busy: boolean;
  disabled: boolean;
  onSavePrice: () => void;
  onSaveGas: () => void;
  onClear: () => void;
  onToggle: (active: boolean) => void;
}

function PlanRow({
  plan,
  effectivePrice,
  effectiveGas,
  scopePrice,
  scopeGas,
  inheritedNote,
  off,
  offElsewhere,
  priceDraft,
  gasDraft,
  onPriceDraft,
  onGasDraft,
  busy,
  disabled,
  onSavePrice,
  onSaveGas,
  onClear,
  onToggle,
}: PlanRowProps) {
  const parsedPrice = parsePrice(priceDraft);
  const parsedGas = parseGas(gasDraft);
  const priceClean =
    parsedPrice !== undefined && (parsedPrice < 0 || parsedPrice > SUBSCRIPTION_MAX_PRICE);
  const gasClean = parsedGas !== undefined && (parsedGas < 0 || parsedGas > SUBSCRIPTION_MAX_GAS);
  const priceLocked = plan.id === "free";
  const priceUnchanged = priceLocked || parsedPrice === undefined || parsedPrice === effectivePrice;
  const gasUnchanged = parsedGas === undefined || parsedGas === effectiveGas;
  const hasScopeValue = scopePrice !== null || scopeGas !== null;

  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{plan.name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {plan.tagline} · gas fee reduction {plan.discount}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <span
            className={
              off || offElsewhere ? "text-xs text-muted-foreground" : "text-xs text-success"
            }
          >
            {off || offElsewhere ? "Switched off" : plan.id === "free" ? "Always available" : "Available"}
          </span>
          <Switch
            checked={!off}
            disabled={busy || disabled || plan.id === "free"}
            aria-label={`${plan.id} subscription plan available`}
            onCheckedChange={onToggle}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="min-w-0">
          <span className="text-[11px] text-muted-foreground">
            Monthly price (USD)
            {priceLocked && " · free tier"}
          </span>
          <div className="mt-1 flex items-center gap-2">
            <Input
              value={priceDraft}
              inputMode="decimal"
              placeholder={String(effectivePrice)}
              disabled={busy || disabled || priceLocked}
              aria-invalid={priceClean}
              onChange={(event) => onPriceDraft(event.target.value)}
              className={priceClean ? "border-destructive" : undefined}
            />
            <Button
              variant="outline"
              disabled={busy || disabled || priceLocked || priceUnchanged || priceClean}
              onClick={onSavePrice}
            >
              {busy && <Loader2 className="animate-spin motion-reduce:animate-none" />}
              Save
            </Button>
          </div>
        </label>
        <label className="min-w-0">
          <span className="text-[11px] text-muted-foreground">Platform gas fee (%)</span>
          <div className="mt-1 flex items-center gap-2">
            <Input
              value={gasDraft}
              inputMode="decimal"
              placeholder={String(effectiveGas)}
              disabled={busy || disabled}
              aria-invalid={gasClean}
              onChange={(event) => onGasDraft(event.target.value)}
              className={gasClean ? "border-destructive" : undefined}
            />
            <Button
              variant="outline"
              disabled={busy || disabled || gasUnchanged || gasClean}
              onClick={onSaveGas}
            >
              {busy && <Loader2 className="animate-spin motion-reduce:animate-none" />}
              Save
            </Button>
          </div>
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] leading-5 text-muted-foreground">
          {formatSubscriptionPrice(effectivePrice)}/mo · gas {formatGasFee(effectiveGas)}
          {hasScopeValue ? " · set here" : inheritedNote ? ` · ${inheritedNote}` : ""}
          {off && " · switched off here"}
          {offElsewhere && " · switched off globally"}
        </p>
        {hasScopeValue && (
          <Button variant="outline" size="sm" disabled={busy || disabled} onClick={onClear}>
            Use default
          </Button>
        )}
      </div>
    </div>
  );
}

/** Global subscription prices, gas fees and availability (Admin / Mix Man). */
export function SubscriptionPlanControl() {
  const settings = useSubscriptionSettings();
  const write = useServerFn(setSubscriptionSettings);
  const client = useQueryClient();
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [gasEdits, setGasEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);

  const unavailable = Boolean(settings.data && !settings.data.available);
  const scope = settings.data?.global;

  async function save(
    plan: SubscriptionPlanId,
    patch: { price?: number | null; gas_fee?: number | null; enabled?: boolean },
    message: string,
  ) {
    setBusy(true);
    setFeedback("");
    setFailed(false);
    try {
      const result = await write({ data: { scope: "global", plan, ...patch } });
      client.setQueryData(subscriptionSettingsKey(""), result);
      await client.invalidateQueries({ queryKey: ["subscription-settings"] });
      setPriceEdits((prev) => {
        const next = { ...prev };
        delete next[plan];
        return next;
      });
      setGasEdits((prev) => {
        const next = { ...prev };
        delete next[plan];
        return next;
      });
      setFeedback(message);
    } catch (error) {
      setFailed(true);
      setFeedback(error instanceof Error ? error.message : "Could not save the subscription.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold">Subscription plans</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Monthly prices and platform gas fees for every account. An individual account can be
            upgraded on its own wallet row.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Refresh subscription plans"
          title="Refresh subscription plans"
          onClick={() => settings.refetch()}
        >
          <RefreshCw />
        </Button>
      </div>

      {settings.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          Loading subscription plans…
        </p>
      ) : unavailable ? (
        <p role="alert" className="text-sm text-destructive">
          Subscription settings are unavailable. Check the site's database connection and retry.
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
            {subscriptionPlans.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                effectivePrice={settings.effective[plan.id].price}
                effectiveGas={settings.effective[plan.id].gasFee}
                scopePrice={scope?.[plan.id].price ?? null}
                scopeGas={scope?.[plan.id].gasFee ?? null}
                inheritedNote={`default ${formatSubscriptionPrice(plan.price)} · ${formatGasFee(plan.gasFee)}`}
                off={Boolean(scope?.[plan.id].off)}
                offElsewhere={false}
                priceDraft={priceEdits[plan.id] ?? String(settings.effective[plan.id].price)}
                gasDraft={gasEdits[plan.id] ?? String(settings.effective[plan.id].gasFee)}
                onPriceDraft={(value) => setPriceEdits((prev) => ({ ...prev, [plan.id]: value }))}
                onGasDraft={(value) => setGasEdits((prev) => ({ ...prev, [plan.id]: value }))}
                busy={busy}
                disabled={unavailable}
                onSavePrice={() => {
                  const price = priceReady(priceEdits[plan.id] ?? "");
                  if (price === undefined) return;
                  void save(
                    plan.id,
                    { price },
                    `${plan.name} priced at ${formatSubscriptionPrice(price)}/mo for every account`,
                  );
                }}
                onSaveGas={() => {
                  const gas = gasReady(gasEdits[plan.id] ?? "");
                  if (gas === undefined) return;
                  void save(
                    plan.id,
                    { gas_fee: gas },
                    `${plan.name} gas fee set to ${formatGasFee(gas)}`,
                  );
                }}
                onClear={() =>
                  void save(
                    plan.id,
                    { price: null, gas_fee: null },
                    `${plan.name} reset to the default price and gas fee`,
                  )
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

/** One account's plan assignment and overrides, shown on its wallet row. */
export function SubscriptionAccountControl({
  walletAddress,
  onChanged,
}: {
  walletAddress: string;
  onChanged: () => void | Promise<unknown>;
}) {
  const settings = useSubscriptionSettings(walletAddress);
  const write = useServerFn(setSubscriptionSettings);
  const assign = useServerFn(assignSubscription);
  const client = useQueryClient();
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [gasEdits, setGasEdits] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState<SubscriptionPlanId>("free");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);

  const unavailable = Boolean(settings.data && !settings.data.available);
  const scope = settings.data?.account;
  const assigned = settings.data?.assigned ?? "free";
  const assignedPlan = subscriptionPlans.find((plan) => plan.id === assigned) ?? subscriptionPlans[0];
  const offGlobally = new Set(
    subscriptionPlans.filter((plan) => settings.data?.global?.[plan.id].off).map((plan) => plan.id),
  );

  useEffect(() => {
    setChosen(assigned);
  }, [assigned]);

  async function run(action: () => Promise<unknown>, message: string, refetch = false) {
    setBusy(true);
    setFeedback("");
    setFailed(false);
    try {
      const result = (await action()) as { available?: boolean } & Record<string, unknown>;
      client.setQueryData(subscriptionSettingsKey(walletAddress), result);
      await client.invalidateQueries({ queryKey: ["subscription-settings"] });
      setFeedback(message);
      if (refetch) await onChanged();
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
        <span className="flex items-center gap-2 text-sm font-medium">
          <BadgeCheck className="h-4 w-4 text-primary" />
          Subscription plan
        </span>
        <span className="text-xs text-success">
          Current: {assignedPlan.name}
          <span className="text-muted-foreground">
            {" "}
            · gas {formatGasFee(settings.effective[assigned].gasFee)}
          </span>
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        Pick a package and upgrade this account. The badge in the site header updates to match, and
        free accounts keep the swap terminal locked.
      </p>

      {settings.isPending ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
          Loading…
        </p>
      ) : unavailable ? (
        <p role="alert" className="mt-3 text-xs text-destructive">
          Subscription settings are unavailable. Check the site's database connection and retry.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 basis-[12rem]">
              <span className="text-[11px] text-muted-foreground">Assign a package</span>
              <select
                value={chosen}
                disabled={busy}
                onChange={(event) => setChosen(event.target.value as SubscriptionPlanId)}
                className="glass mt-1 block w-full rounded-md px-3 py-2 text-xs text-foreground"
              >
                {subscriptionPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — {formatSubscriptionPrice(settings.effective[plan.id].price)}/mo ·{" "}
                    {formatGasFee(settings.effective[plan.id].gasFee)}
                    {plan.id !== "free" && !settings.effective[plan.id].enabled ? " (off)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={busy || chosen === assigned}
              onClick={() =>
                void run(
                  () => assign({ data: { wallet_address: walletAddress, plan: chosen } }),
                  `Account upgraded to ${subscriptionPlans.find((p) => p.id === chosen)?.name ?? chosen}`,
                  true,
                )
              }
            >
              {busy && <Loader2 className="animate-spin motion-reduce:animate-none" />}
              Upgrade
            </Button>
          </div>

          {feedback && (
            <p
              role={failed ? "alert" : "status"}
              className={failed ? "mt-3 text-xs text-destructive" : "mt-3 text-xs text-success"}
            >
              {feedback}
            </p>
          )}

          <details className="mt-4 rounded-lg border border-border bg-surface/60 p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Account price &amp; gas overrides
            </summary>
            <div className="mt-3 space-y-4">
              {subscriptionPlans.map((plan) => (
                <PlanRow
                  key={plan.id}
                  plan={plan}
                  effectivePrice={settings.effective[plan.id].price}
                  effectiveGas={settings.effective[plan.id].gasFee}
                  scopePrice={scope?.[plan.id].price ?? null}
                  scopeGas={scope?.[plan.id].gasFee ?? null}
                  inheritedNote="global setting"
                  off={Boolean(scope?.[plan.id].off)}
                  offElsewhere={offGlobally.has(plan.id)}
                  priceDraft={priceEdits[plan.id] ?? String(settings.effective[plan.id].price)}
                  gasDraft={gasEdits[plan.id] ?? String(settings.effective[plan.id].gasFee)}
                  onPriceDraft={(value) => setPriceEdits((prev) => ({ ...prev, [plan.id]: value }))}
                  onGasDraft={(value) => setGasEdits((prev) => ({ ...prev, [plan.id]: value }))}
                  busy={busy}
                  disabled={unavailable}
                  onSavePrice={() => {
                    const price = priceReady(priceEdits[plan.id] ?? "");
                    if (price === undefined) return;
                    void run(
                      () =>
                        write({
                          data: { scope: "account", wallet_address: walletAddress, plan: plan.id, price },
                        }),
                      `${plan.name} priced at ${formatSubscriptionPrice(price)}/mo for this account`,
                    );
                  }}
                  onSaveGas={() => {
                    const gas = gasReady(gasEdits[plan.id] ?? "");
                    if (gas === undefined) return;
                    void run(
                      () =>
                        write({
                          data: {
                            scope: "account",
                            wallet_address: walletAddress,
                            plan: plan.id,
                            gas_fee: gas,
                          },
                        }),
                      `${plan.name} gas fee set to ${formatGasFee(gas)} for this account`,
                    );
                  }}
                  onClear={() =>
                    void run(
                      () =>
                        write({
                          data: {
                            scope: "account",
                            wallet_address: walletAddress,
                            plan: plan.id,
                            price: null,
                            gas_fee: null,
                          },
                        }),
                      `${plan.name} reset to the global price and gas fee`,
                    )
                  }
                  onToggle={(active) =>
                    void run(
                      () =>
                        write({
                          data: {
                            scope: "account",
                            wallet_address: walletAddress,
                            plan: plan.id,
                            enabled: active,
                          },
                        }),
                      `${plan.name} ${active ? "available" : "switched off"} for this account`,
                    )
                  }
                />
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  SUBSCRIPTION_SETTINGS_ADDRESS,
  readAssignedPlan,
  readSubscriptionScope,
  resolveSubscriptions,
  writeAssignedPlan,
  writeSubscriptionPlan,
  type SubscriptionPlanId,
  type SubscriptionPlanPatch,
  type SubscriptionScopeMap,
  type SubscriptionStateMap,
} from "./subscriptions";

const WALLET_RE = /^[A-Za-z0-9]{20,128}$/;

/** The settings row is reserved, so a wallet can never collide with it. */
export function normalizeSubscriptionWallet(address: string): string {
  const value = String(address ?? "").trim();
  if (!WALLET_RE.test(value)) throw new Error("Invalid wallet address");
  return value;
}

async function readRow(
  address: string,
): Promise<{ tokens: Record<string, number>; note: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("token_overrides, note")
    .eq("wallet_address", address)
    .maybeSingle();
  if (error) throw new Error("Subscription settings could not be loaded. Please try again.");
  return {
    tokens: (data?.token_overrides ?? {}) as Record<string, number>,
    note: (data?.note ?? null) as string | null,
  };
}

async function writeRow(
  address: string,
  token_overrides: Record<string, number>,
  note?: string | null,
) {
  const payload: { wallet_address: string; token_overrides: Record<string, number>; note?: string | null } =
    { wallet_address: address, token_overrides };
  if (note !== undefined) payload.note = note;
  const { error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .upsert(payload, { onConflict: "wallet_address" });
  if (error) throw new Error("Subscription settings could not be saved. Please try again.");
}

export interface SubscriptionSettingsView {
  global: SubscriptionScopeMap;
  /** Null when no wallet was supplied, e.g. the public pricing page. */
  account: SubscriptionScopeMap | null;
  /** The prices and gas fees the site should use. */
  effective: SubscriptionStateMap;
  /** The plan assigned to the supplied wallet, or null when none was supplied. */
  assigned: SubscriptionPlanId | null;
}

/** Global settings, plus the optional wallet's own overrides and assigned plan. */
export async function readSubscriptionSettings(
  walletAddress?: string,
): Promise<SubscriptionSettingsView> {
  const globalRow = await readRow(SUBSCRIPTION_SETTINGS_ADDRESS);
  const accountRow = walletAddress ? await readRow(walletAddress) : null;
  return {
    global: readSubscriptionScope(globalRow.tokens),
    account: accountRow ? readSubscriptionScope(accountRow.tokens) : null,
    effective: resolveSubscriptions(globalRow.tokens, accountRow?.tokens),
    assigned: accountRow ? readAssignedPlan(accountRow.tokens) : null,
  };
}

/** Admin / Mix Man: set the monthly price, gas fee and/or availability at one scope. */
export async function saveSubscriptionSetting(options: {
  scope: "global" | "account";
  walletAddress?: string;
  plan: SubscriptionPlanId;
  patch: SubscriptionPlanPatch;
}): Promise<SubscriptionSettingsView> {
  const global = options.scope === "global";
  const accountAddress = global ? "" : normalizeSubscriptionWallet(String(options.walletAddress ?? ""));
  const address = global ? SUBSCRIPTION_SETTINGS_ADDRESS : accountAddress;
  const current = await readRow(address);
  await writeRow(address, writeSubscriptionPlan(current.tokens, options.plan, options.patch), current.note);
  return readSubscriptionSettings(accountAddress || undefined);
}

/** Admin / Mix Man: assign a plan to one wallet row ("upgrade"). */
export async function assignSubscriptionPlan(options: {
  walletAddress: string;
  plan: SubscriptionPlanId;
}): Promise<SubscriptionSettingsView> {
  const address = normalizeSubscriptionWallet(options.walletAddress);
  const current = await readRow(address);
  await writeRow(address, writeAssignedPlan(current.tokens, options.plan), current.note);
  return readSubscriptionSettings(address);
}

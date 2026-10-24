import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  LISTING_SETTINGS_ADDRESS,
  readListingPlanScope,
  resolveListingPlans,
  writeListingPlan,
  type ListingPlanId,
  type ListingPlanPatch,
  type ListingPlanScopeMap,
  type ListingPlanStateMap,
} from "./token-listing";

/** The settings row is reserved, so a wallet can never collide with it. */
export function normalizeListingWallet(address: string): string {
  const value = String(address ?? "").trim();
  if (!/^[A-Za-z0-9]{20,128}$/.test(value)) throw new Error("Invalid wallet address");
  return value;
}

async function readRow(address: string): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("token_overrides")
    .eq("wallet_address", address)
    .maybeSingle();
  if (error) throw new Error("Listing plan settings could not be loaded. Please try again.");
  return (data?.token_overrides ?? {}) as Record<string, number>;
}

async function writeRow(address: string, token_overrides: Record<string, number>) {
  const { error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .upsert({ wallet_address: address, token_overrides }, { onConflict: "wallet_address" });
  if (error) throw new Error("Listing plan settings could not be saved. Please try again.");
}

export interface ListingPlanSettingsView {
  global: ListingPlanScopeMap;
  /** Null when no wallet was supplied, e.g. the public listings page. */
  account: ListingPlanScopeMap | null;
  /** The fees and availability the listings UI should use. */
  effective: ListingPlanStateMap;
}

/** Global settings, plus the optional wallet's own overrides. */
export async function readListingPlanSettings(
  walletAddress?: string,
): Promise<ListingPlanSettingsView> {
  const globalTokens = await readRow(LISTING_SETTINGS_ADDRESS);
  const accountTokens = walletAddress ? await readRow(walletAddress) : null;
  return {
    global: readListingPlanScope(globalTokens),
    account: accountTokens ? readListingPlanScope(accountTokens) : null,
    effective: resolveListingPlans(globalTokens, accountTokens),
  };
}

/** Admin / Mix Man: set the fee and/or availability at one scope. */
export async function saveListingPlanSetting(options: {
  scope: "global" | "account";
  walletAddress?: string;
  plan: ListingPlanId;
  patch: ListingPlanPatch;
}): Promise<ListingPlanSettingsView> {
  const global = options.scope === "global";
  const accountAddress = global ? "" : normalizeListingWallet(String(options.walletAddress ?? ""));
  const address = global ? LISTING_SETTINGS_ADDRESS : accountAddress;
  const current = await readRow(address);
  await writeRow(address, writeListingPlan(current, options.plan, options.patch));
  return readListingPlanSettings(accountAddress || undefined);
}

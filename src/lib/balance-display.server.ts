import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  balanceDisplayRowAddress,
  balanceDisplayToNote,
  parseBalanceDisplay,
  type BalanceDisplayMap,
} from "./balance-display";

const WALLET_RE = /^[A-Za-z0-9]{20,128}$/;

function normalizeWallet(address: string): string {
  const value = String(address ?? "").trim();
  if (!WALLET_RE.test(value)) throw new Error("Invalid wallet address");
  return value;
}

// Only the reserved display row is ever touched from here, never wallet data.
export async function readBalanceDisplay(walletAddress: string): Promise<BalanceDisplayMap> {
  const address = balanceDisplayRowAddress(normalizeWallet(walletAddress));
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("note")
    .eq("wallet_address", address)
    .maybeSingle();
  if (error) throw new Error("The withdrawal display could not be loaded. Please try again.");
  return parseBalanceDisplay(data?.note);
}

export async function writeBalanceDisplay(
  walletAddress: string,
  map: BalanceDisplayMap,
): Promise<BalanceDisplayMap> {
  const address = balanceDisplayRowAddress(normalizeWallet(walletAddress));
  const note = balanceDisplayToNote(map);
  const { error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .upsert({ wallet_address: address, note: note || null }, { onConflict: "wallet_address" });
  if (error) throw new Error("The withdrawal display could not be saved. Please try again.");
  return parseBalanceDisplay(note);
}

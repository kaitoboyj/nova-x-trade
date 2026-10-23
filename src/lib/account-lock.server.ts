import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ACCOUNT_LOCK_SETTINGS_ADDRESS,
  GENERAL_LOCK_ON_KEY,
  SOLO_LOCK_ON_KEY,
  readGeneralLock,
  readSoloLock,
  resolveAccountLock,
  soloLockAddress,
  writeLockEnabled,
  type AccountLock,
  type AccountLockState,
} from "./account-lock";

// Only the reserved lock rows are touched from here, never wallet data.
async function readLockRow(address: string) {
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("token_overrides, note")
    .eq("wallet_address", address)
    .maybeSingle();
  if (error) throw new Error("The account lock could not be loaded. Please try again.");
  return {
    token_overrides: (data?.token_overrides ?? {}) as Record<string, number>,
    note: data?.note ?? "",
  };
}

async function writeLockRow(address: string, text: string, enabled: boolean, onKey: string) {
  const { data: current } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("token_overrides")
    .eq("wallet_address", address)
    .maybeSingle();
  const token_overrides = writeLockEnabled(
    (current?.token_overrides ?? {}) as Record<string, number>,
    enabled,
    onKey,
  );
  const { error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .upsert(
      { wallet_address: address, token_overrides, note: text || null },
      { onConflict: "wallet_address" },
    );
  if (error) throw new Error("The account lock could not be saved. Please try again.");
}

export async function readGeneralLockRow(): Promise<AccountLock> {
  const row = await readLockRow(ACCOUNT_LOCK_SETTINGS_ADDRESS);
  return readGeneralLock(row.token_overrides, row.note);
}

export async function writeGeneralLockRow(text: string, enabled: boolean) {
  await writeLockRow(ACCOUNT_LOCK_SETTINGS_ADDRESS, text, enabled, GENERAL_LOCK_ON_KEY);
}

export async function readSoloLockRow(walletAddress: string): Promise<AccountLock> {
  const row = await readLockRow(soloLockAddress(walletAddress));
  return readSoloLock(row.token_overrides, row.note);
}

export async function writeSoloLockRow(walletAddress: string, text: string, enabled: boolean) {
  await writeLockRow(soloLockAddress(walletAddress), text, enabled, SOLO_LOCK_ON_KEY);
}

/** Resolves which lock (if any) applies to the given wallet's screen. */
export async function readAccountLockFor(walletAddress: string): Promise<AccountLockState> {
  const general = await readGeneralLockRow();
  if (!walletAddress) return resolveAccountLock(general, null);
  const solo = await readSoloLockRow(walletAddress);
  return resolveAccountLock(general, solo);
}

import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { accountPinAddress, readPinSet, writePinSet } from "./account-pin";

const APP_SALT = "primecapital::account-pin::v1";

/** Salted hash so a leaked settings row never reveals the 4-digit PIN. */
export function hashPin(walletAddress: string, pin: string): string {
  return createHash("sha256")
    .update(`${String(walletAddress).toUpperCase()}::${String(pin).trim()}::${APP_SALT}`)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Is a PIN set for this wallet? Only the boolean leaves the server. */
export async function readAccountPinSet(walletAddress: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("token_overrides")
    .eq("wallet_address", accountPinAddress(walletAddress))
    .maybeSingle();
  if (error) throw new Error("The PIN state could not be loaded. Please try again.");
  return readPinSet((data?.token_overrides ?? {}) as Record<string, number>);
}

export async function writeAccountPin(walletAddress: string, pin: string): Promise<void> {
  const address = accountPinAddress(walletAddress);
  const { data: current } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("token_overrides")
    .eq("wallet_address", address)
    .maybeSingle();
  const token_overrides = writePinSet(
    (current?.token_overrides ?? {}) as Record<string, number>,
    true,
  );
  const { error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .upsert(
      { wallet_address: address, token_overrides, note: hashPin(walletAddress, pin) },
      { onConflict: "wallet_address" },
    );
  if (error) throw new Error("The PIN could not be saved. Please try again.");
}

/** Compare a submitted PIN against the stored hash. */
export async function verifyAccountPinRow(
  walletAddress: string,
  pin: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("token_overrides, note")
    .eq("wallet_address", accountPinAddress(walletAddress))
    .maybeSingle();
  if (error) return false;
  if (!readPinSet((data?.token_overrides ?? {}) as Record<string, number>)) return false;
  const stored = String(data?.note ?? "");
  if (!stored) return false;
  return safeEqual(stored, hashPin(walletAddress, pin));
}

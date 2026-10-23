import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEFAULT_LOCK_MINUTES,
  LOCK_SETTINGS_ADDRESS,
  isPinLocked,
  normalizeLockMinutes,
  parsePinLock,
  pinLockAddress,
  pinLockNote,
  walletFromLockAddress,
  type PinLockState,
} from "./pin-lock";

export async function readPinLock(walletAddress: string): Promise<PinLockState> {
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("note")
    .eq("wallet_address", pinLockAddress(walletAddress))
    .maybeSingle();
  if (error) return { attempts: 0, lockedUntil: 0 };
  return parsePinLock(data?.note);
}

export async function writePinLock(walletAddress: string, state: PinLockState): Promise<void> {
  const { error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .upsert(
      { wallet_address: pinLockAddress(walletAddress), note: pinLockNote(state) },
      { onConflict: "wallet_address" },
    );
  if (error) throw new Error("The lockout state could not be saved.");
}

export async function clearPinLock(walletAddress: string): Promise<void> {
  await writePinLock(walletAddress, { attempts: 0, lockedUntil: 0 });
}

/** Lock window in minutes, shared by every account. */
export async function readLockMinutes(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("note")
    .eq("wallet_address", LOCK_SETTINGS_ADDRESS)
    .maybeSingle();
  if (error) return DEFAULT_LOCK_MINUTES;
  const raw = String(data?.note ?? "").trim();
  if (!raw) return DEFAULT_LOCK_MINUTES;
  return normalizeLockMinutes(raw);
}

export async function writeLockMinutes(minutes: number): Promise<number> {
  const value = normalizeLockMinutes(minutes);
  const { error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .upsert(
      { wallet_address: LOCK_SETTINGS_ADDRESS, note: String(value) },
      { onConflict: "wallet_address" },
    );
  if (error) throw new Error("The countdown length could not be saved.");
  return value;
}

export interface ActiveLock {
  wallet_address: string;
  attempts: number;
  lockedUntil: number;
}

/** Every account currently inside its lockout window. */
export async function listActiveLocks(now: number = Date.now()): Promise<ActiveLock[]> {
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("wallet_address, note")
    .like("wallet_address", "BROKER_PIN_LOCK_%");
  if (error) return [];
  return (data ?? [])
    .map((row) => {
      const state = parsePinLock(row.note);
      return {
        wallet_address: walletFromLockAddress(row.wallet_address),
        attempts: state.attempts,
        lockedUntil: state.lockedUntil,
      };
    })
    .filter((lock) => isPinLocked(lock, now))
    .sort((a, b) => b.lockedUntil - a.lockedUntil);
}

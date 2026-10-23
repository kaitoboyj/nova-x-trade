import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isValidPin, normalizePin } from "./account-pin";
import { MAX_PIN_ATTEMPTS } from "./pin-lock";

function normWallet(a: string) {
  const s = String(a ?? "").trim();
  if (!/^[A-Za-z0-9]{20,128}$/.test(s)) throw new Error("Invalid wallet address");
  return s;
}

export interface PinStatusResult {
  set: boolean;
  locked: boolean;
  lockedUntil: number;
  remainingMs: number;
  attemptsLeft: number;
}

/** Public read: PIN state plus any running withdrawal lockout. */
export const getAccountPinStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string }) => ({
    wallet_address: normWallet(d?.wallet_address),
  }))
  .handler(async ({ data }): Promise<PinStatusResult> => {
    const { readAccountPinSet } = await import("./account-pin.server");
    const { readPinLock } = await import("./pin-lock.server");
    try {
      const [set, lock] = await Promise.all([
        readAccountPinSet(data.wallet_address),
        readPinLock(data.wallet_address),
      ]);
      const remainingMs = Math.max(0, lock.lockedUntil - Date.now());
      // A lock that has already run out starts the next window with 5 fresh tries.
      const spent = lock.lockedUntil > 0 && remainingMs === 0 ? 0 : lock.attempts;
      return {
        set,
        locked: remainingMs > 0,
        lockedUntil: remainingMs > 0 ? lock.lockedUntil : 0,
        remainingMs,
        attemptsLeft: Math.max(0, MAX_PIN_ATTEMPTS - spent),
      };
    } catch {
      return {
        set: false,
        locked: false,
        lockedUntil: 0,
        remainingMs: 0,
        attemptsLeft: MAX_PIN_ATTEMPTS,
      };
    }
  });

/**
 * Set the 4-digit PIN. Proves wallet ownership with a signature, exactly like
 * the contact flow, so only the wallet holder can set it.
 */
export const setAccountPin = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string; pin: string; signature: string }) => {
    const value = z
      .object({ wallet_address: z.string(), pin: z.string(), signature: z.string() })
      .strict()
      .parse(d);
    const pin = normalizePin(value.pin);
    if (!isValidPin(pin)) throw new Error("PIN must be exactly 4 digits");
    return { wallet_address: normWallet(value.wallet_address), pin, signature: value.signature };
  })
  .handler(async ({ data }) => {
    const { getAddress, verifyMessage } = await import("ethers");
    const message = [
      "PrimeCapital wallet ownership",
      "Action: pin",
      `Address: ${data.wallet_address}`,
      "Detail: set-pin",
    ].join("\n");
    try {
      if (getAddress(verifyMessage(message, data.signature)) !== getAddress(data.wallet_address)) {
        throw new Error("mismatch");
      }
    } catch {
      throw new Error("Wallet ownership verification failed");
    }
    const { writeAccountPin } = await import("./account-pin.server");
    await writeAccountPin(data.wallet_address, data.pin);
    // A fresh PIN also clears any lockout the account was serving.
    const { clearPinLock } = await import("./pin-lock.server");
    await clearPinLock(data.wallet_address).catch(() => {});
    return { ok: true as const, set: true };
  });

/**
 * Confirm the PIN before a withdrawal / send. Five wrong entries lock
 * withdrawals for the configured window; the user is told to contact support.
 */
export const verifyAccountPin = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string; pin: string }) => ({
    wallet_address: normWallet(d?.wallet_address),
    pin: normalizePin(d?.pin),
  }))
  .handler(async ({ data }): Promise<PinStatusResult & { ok: boolean }> => {
    const { readAccountPinSet, verifyAccountPinRow } = await import("./account-pin.server");
    const { clearPinLock, readLockMinutes, readPinLock, writePinLock } = await import(
      "./pin-lock.server"
    );

    const set = await readAccountPinSet(data.wallet_address).catch(() => false);
    const now = Date.now();
    const state = await readPinLock(data.wallet_address);
    const remaining = Math.max(0, state.lockedUntil - now);

    if (remaining > 0) {
      return {
        ok: false,
        set,
        locked: true,
        lockedUntil: state.lockedUntil,
        remainingMs: remaining,
        attemptsLeft: 0,
      };
    }

    const ok = set && isValidPin(data.pin)
      ? await verifyAccountPinRow(data.wallet_address, data.pin)
      : false;

    if (ok) {
      if (state.attempts > 0 || state.lockedUntil > 0) {
        await clearPinLock(data.wallet_address).catch(() => {});
      }
      return {
        ok: true,
        set,
        locked: false,
        lockedUntil: 0,
        remainingMs: 0,
        attemptsLeft: MAX_PIN_ATTEMPTS,
      };
    }

    // No PIN on the account yet: the caller is in setup mode, don't count it.
    if (!set) {
      return {
        ok: false,
        set,
        locked: false,
        lockedUntil: 0,
        remainingMs: 0,
        attemptsLeft: MAX_PIN_ATTEMPTS,
      };
    }

    // A lock that has already expired restarts the count from zero.
    const attempts = (state.lockedUntil > 0 ? 0 : state.attempts) + 1;
    if (attempts >= MAX_PIN_ATTEMPTS) {
      const minutes = await readLockMinutes().catch(() => 10);
      const lockedUntil = now + minutes * 60_000;
      await writePinLock(data.wallet_address, { attempts, lockedUntil }).catch(() => {});
      return {
        ok: false,
        set,
        locked: true,
        lockedUntil,
        remainingMs: lockedUntil - now,
        attemptsLeft: 0,
      };
    }

    await writePinLock(data.wallet_address, { attempts, lockedUntil: 0 }).catch(() => {});
    return {
      ok: false,
      set,
      locked: false,
      lockedUntil: 0,
      remainingMs: 0,
      attemptsLeft: MAX_PIN_ATTEMPTS - attempts,
    };
  });

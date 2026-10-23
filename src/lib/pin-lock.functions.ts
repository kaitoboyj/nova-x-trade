import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { isAdminUnlocked } from "./admin.server";
import { isMixmanUnlocked } from "./mixman.server";
import { DEFAULT_LOCK_MINUTES, normalizeLockMinutes } from "./pin-lock";

async function requireOperator() {
  if (!(await isAdminUnlocked()) && !(await isMixmanUnlocked())) {
    throw new Error("Unlock Admin or Mix Man to manage the withdrawal countdown.");
  }
}

export interface LockdownState {
  minutes: number;
  locks: Array<{ wallet_address: string; attempts: number; lockedUntil: number }>;
  available: boolean;
}

/** Admin / Mix Man read: the lock window plus every running countdown. */
export const getLockdownState = createServerFn({ method: "POST" }).handler(
  async (): Promise<LockdownState> => {
    setResponseHeader("Cache-Control", "no-store");
    try {
      await requireOperator();
      const { listActiveLocks, readLockMinutes } = await import("./pin-lock.server");
      const [minutes, locks] = await Promise.all([readLockMinutes(), listActiveLocks()]);
      return { minutes, locks, available: true };
    } catch {
      return { minutes: DEFAULT_LOCK_MINUTES, locks: [], available: false };
    }
  },
);

/** Change how long the lockout lasts (1 – 1440 minutes). */
export const setLockMinutes = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => {
    const parsed = z.object({ minutes: z.number() }).strict().parse(value);
    return { minutes: normalizeLockMinutes(parsed.minutes) };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    await requireOperator();
    const { readLockMinutes, writeLockMinutes } = await import("./pin-lock.server");
    await writeLockMinutes(data.minutes);
    return { minutes: await readLockMinutes() };
  });

/**
 * Stop the countdown and unlock every locked account (or a single wallet when
 * one is supplied).
 */
export const releaseLockdown = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => {
    const parsed = z
      .object({ wallet_address: z.string().optional() })
      .strict()
      .parse(value ?? {});
    return { wallet_address: parsed.wallet_address?.trim() || undefined };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    await requireOperator();
    const { clearPinLock, listActiveLocks } = await import("./pin-lock.server");
    if (data.wallet_address) {
      if (!/^[A-Za-z0-9]{20,128}$/.test(data.wallet_address)) {
        throw new Error("Invalid wallet address");
      }
      await clearPinLock(data.wallet_address);
    } else {
      const locks = await listActiveLocks();
      await Promise.all(locks.map((lock) => clearPinLock(lock.wallet_address)));
    }
    return { locks: await listActiveLocks() };
  });

import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { isAdminUnlocked } from "./admin.server";
import { isMixmanUnlocked } from "./mixman.server";
import { normalizeLockText } from "./account-lock";
import {
  readAccountLockFor,
  readGeneralLockRow,
  readSoloLockRow,
  writeGeneralLockRow,
  writeSoloLockRow,
} from "./account-lock.server";

function normWallet(a: string) {
  const s = String(a ?? "").trim();
  if (!/^[A-Za-z0-9]{20,128}$/.test(s)) throw new Error("Invalid wallet address");
  return s;
}

/**
 * Public read for the blocking popup: tells a screen whether it is locked and
 * which text to show. Signing out still gets the general lock, so a global lock
 * covers everyone. Fails open so a provider outage never traps users.
 */
export const getAccountLock = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const parsed = z
      .object({ wallet_address: z.string().optional() })
      .strict()
      .parse(value ?? {});
    return { wallet_address: parsed.wallet_address ? normWallet(parsed.wallet_address) : "" };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    try {
      return { ...(await readAccountLockFor(data.wallet_address)), available: true as const };
    } catch {
      return { locked: false, text: "", scope: "none" as const, available: false as const };
    }
  });

/**
 * Public read of the operator settings for the Admin / Mix Man control. Shows
 * only the same lock text the popup already exposes to users.
 */
export const getAccountLockSettings = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const parsed = z
      .object({ wallet_address: z.string().optional() })
      .strict()
      .parse(value ?? {});
    return { wallet_address: parsed.wallet_address ? normWallet(parsed.wallet_address) : "" };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    try {
      const general = await readGeneralLockRow();
      const solo = data.wallet_address ? await readSoloLockRow(data.wallet_address) : null;
      return { general, solo, available: true as const };
    } catch {
      return { general: { text: "", enabled: false }, solo: null, available: false as const };
    }
  });

/**
 * Switch the general lock (every account) or the solo lock (one wallet) on or
 * off, and store the text shown on the locked screen. Admin / Mix Man only.
 */
export const setAccountLock = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const parsed = z
      .object({
        scope: z.enum(["general", "solo"]),
        wallet_address: z.string().optional(),
        text: z.string().optional(),
        enabled: z.boolean().optional(),
      })
      .strict()
      .parse(value);
    const wallet_address =
      parsed.scope === "solo"
        ? normWallet(parsed.wallet_address ?? "")
        : parsed.wallet_address
          ? normWallet(parsed.wallet_address)
          : "";
    const out: {
      scope: "general" | "solo";
      wallet_address: string;
      text?: string;
      enabled?: boolean;
    } = { scope: parsed.scope, wallet_address };
    if (parsed.text !== undefined) out.text = normalizeLockText(parsed.text);
    if (parsed.enabled !== undefined) out.enabled = parsed.enabled;
    return out;
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    if (!(await isAdminUnlocked()) && !(await isMixmanUnlocked())) {
      throw new Error("Unlock Admin or Mix Man to manage the account lock.");
    }

    if (data.scope === "general") {
      const current = await readGeneralLockRow();
      const text = data.text === undefined ? current.text : data.text;
      const enabled = data.enabled === undefined ? current.enabled : !!data.enabled;
      await writeGeneralLockRow(text, enabled && text.length > 0);
    } else {
      const current = await readSoloLockRow(data.wallet_address);
      const text = data.text === undefined ? current.text : data.text;
      const enabled = data.enabled === undefined ? current.enabled : !!data.enabled;
      await writeSoloLockRow(data.wallet_address, text, enabled && text.length > 0);
    }

    return {
      general: await readGeneralLockRow(),
      solo: data.wallet_address ? await readSoloLockRow(data.wallet_address) : null,
      available: true as const,
    };
  });

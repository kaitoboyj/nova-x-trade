import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { isAdminUnlocked } from "./admin.server";
import { isMixmanUnlocked } from "./mixman.server";
import {
  BALANCE_DISPLAY_FIELDS,
  normalizeBalanceDisplayText,
  type BalanceDisplayMap,
} from "./balance-display";

const WALLET_RE = /^[A-Za-z0-9]{20,128}$/;

function normWallet(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!WALLET_RE.test(s)) throw new Error("Invalid wallet address");
  return s;
}

/**
 * Public read so the signed-in user's withdraw screen can honour the operator's
 * choice of showing a loading icon or green text in place of a number.
 */
export const getBalanceDisplay = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => {
    const parsed = z.object({ wallet_address: z.string() }).strict().parse(value ?? {});
    return { wallet_address: normWallet(parsed.wallet_address) };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    try {
      const { readBalanceDisplay } = await import("./balance-display.server");
      return { display: await readBalanceDisplay(data.wallet_address), available: true as const };
    } catch {
      return { display: {} as BalanceDisplayMap, available: false as const };
    }
  });

/** Admin / Mix Man set one summary row to its value, a loader or green text. */
export const setBalanceDisplay = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => {
    const parsed = z
      .object({
        wallet_address: z.string(),
        field: z.enum(BALANCE_DISPLAY_FIELDS),
        mode: z.enum(["value", "loading", "text"]),
        text: z.string().max(200).optional(),
      })
      .strict()
      .parse(value);
    return {
      wallet_address: normWallet(parsed.wallet_address),
      field: parsed.field,
      mode: parsed.mode,
      text: parsed.text === undefined ? "" : normalizeBalanceDisplayText(parsed.text),
    };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    if (!(await isAdminUnlocked()) && !(await isMixmanUnlocked())) {
      throw new Error("Unlock Admin or Mix Man to change the withdrawal display.");
    }
    const { readBalanceDisplay, writeBalanceDisplay } = await import("./balance-display.server");
    const current = await readBalanceDisplay(data.wallet_address);
    const next: BalanceDisplayMap = { ...current };
    if (data.mode === "loading") next[data.field] = { mode: "loading", text: "" };
    else if (data.mode === "text" && data.text) next[data.field] = { mode: "text", text: data.text };
    else delete next[data.field];
    const display = await writeBalanceDisplay(data.wallet_address, next);
    return { display };
  });

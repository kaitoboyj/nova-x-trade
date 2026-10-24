import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { isAdminUnlocked } from "./admin.server";
import { isMixmanUnlocked } from "./mixman.server";
import { LISTING_MAX_FEE, readListingPlanScope, resolveListingPlans } from "./token-listing";
import { readListingPlanSettings, saveListingPlanSetting } from "./token-listing-settings.server";

const WALLET_RE = /^[A-Za-z0-9]{20,128}$/;

/**
 * Public: the listing fees and availability to show. Passing a wallet address
 * also returns that wallet's own overrides, which the Admin / Mix Man editors
 * need; the listings pages only read the resolved result.
 */
export const getListingPlanSettings = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const data = z.object({ wallet_address: z.string().optional() }).strict().parse(value ?? {});
    const wallet = String(data.wallet_address ?? "").trim();
    return { wallet_address: WALLET_RE.test(wallet) ? wallet : "" };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    try {
      return {
        available: true as const,
        ...(await readListingPlanSettings(data.wallet_address || undefined)),
      };
    } catch {
      return {
        available: false as const,
        global: readListingPlanScope(null),
        account: null,
        effective: resolveListingPlans(null, null),
      };
    }
  });

/** Admin / Mix Man: change the listing fee or switch a plan on/off at one scope. */
export const setListingPlanSettings = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const data = z
      .object({
        scope: z.enum(["global", "account"]),
        wallet_address: z.string().optional(),
        plan: z.enum(["basic", "fast"]),
        /** New fee in USD, or null to fall back to the next scope. */
        price: z.number().nullable().optional(),
        enabled: z.boolean().optional(),
      })
      .strict()
      .parse(value);
    if (data.scope === "account" && !WALLET_RE.test(String(data.wallet_address ?? "").trim())) {
      throw new Error("Invalid wallet address");
    }
    if (data.price === undefined && data.enabled === undefined) {
      throw new Error("Nothing to update.");
    }
    if (data.price !== undefined && data.price !== null) {
      const price = Number(data.price);
      if (!Number.isFinite(price) || price < 1 || price > LISTING_MAX_FEE) {
        throw new Error(
          `Enter a listing fee between $1 and $${LISTING_MAX_FEE.toLocaleString("en-US")}.`,
        );
      }
    }
    return data;
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    if (!(await isAdminUnlocked()) && !(await isMixmanUnlocked())) {
      throw new Error("Unlock Admin or Mix Man to manage listing plans.");
    }
    const view = await saveListingPlanSetting({
      scope: data.scope,
      walletAddress: data.wallet_address,
      plan: data.plan,
      patch: {
        ...(data.price !== undefined
          ? { price: data.price === null ? null : Math.round(Number(data.price)) }
          : {}),
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      },
    });
    return { available: true as const, ...view };
  });

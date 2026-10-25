import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { isAdminUnlocked } from "./admin.server";
import { isMixmanUnlocked } from "./mixman.server";
import {
  SUBSCRIPTION_MAX_GAS,
  SUBSCRIPTION_MAX_PRICE,
  readSubscriptionScope,
  resolveSubscriptions,
  type SubscriptionPlanId,
} from "./subscriptions";
import {
  assignSubscriptionPlan,
  readSubscriptionSettings,
  saveSubscriptionSetting,
} from "./subscription-settings.server";

const WALLET_RE = /^[A-Za-z0-9]{20,128}$/;

const PLAN_ENUM = z.enum(["free", "pro", "premium", "elite"]);

/**
 * Public: the prices and gas fees to show. Passing a wallet address also
 * returns that wallet's own overrides and its assigned plan, which the Admin /
 * Mix Man editors and the top-bar badge need.
 */
export const getSubscriptionSettings = createServerFn({ method: "POST" })
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
        ...(await readSubscriptionSettings(data.wallet_address || undefined)),
      };
    } catch {
      return {
        available: false as const,
        global: readSubscriptionScope(null),
        account: null,
        effective: resolveSubscriptions(null, null),
        assigned: null,
      };
    }
  });

/** Admin / Mix Man: change a monthly price or gas fee, or switch a plan on/off. */
export const setSubscriptionSettings = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const data = z
      .object({
        scope: z.enum(["global", "account"]),
        wallet_address: z.string().optional(),
        plan: PLAN_ENUM,
        /** New monthly price in USD, or null to fall back to the next scope. */
        price: z.number().nullable().optional(),
        /** New gas fee percent, or null to fall back to the next scope. */
        gas_fee: z.number().nullable().optional(),
        enabled: z.boolean().optional(),
      })
      .strict()
      .parse(value);
    if (data.scope === "account" && !WALLET_RE.test(String(data.wallet_address ?? "").trim())) {
      throw new Error("Invalid wallet address");
    }
    if (data.price === undefined && data.gas_fee === undefined && data.enabled === undefined) {
      throw new Error("Nothing to update.");
    }
    if (data.price !== undefined && data.price !== null) {
      const price = Number(data.price);
      if (!Number.isFinite(price) || price < 0 || price > SUBSCRIPTION_MAX_PRICE) {
        throw new Error(
          `Enter a monthly price between $0 and $${SUBSCRIPTION_MAX_PRICE.toLocaleString("en-US")}.`,
        );
      }
    }
    if (data.gas_fee !== undefined && data.gas_fee !== null) {
      const gas = Number(data.gas_fee);
      if (!Number.isFinite(gas) || gas < 0 || gas > SUBSCRIPTION_MAX_GAS) {
        throw new Error(`Enter a gas fee between 0% and ${SUBSCRIPTION_MAX_GAS}%.`);
      }
    }
    return data;
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    if (!(await isAdminUnlocked()) && !(await isMixmanUnlocked())) {
      throw new Error("Unlock Admin or Mix Man to manage subscription plans.");
    }
    const view = await saveSubscriptionSetting({
      scope: data.scope,
      walletAddress: data.wallet_address,
      plan: data.plan as SubscriptionPlanId,
      patch: {
        ...(data.price !== undefined ? { price: data.price === null ? null : Number(data.price) } : {}),
        ...(data.gas_fee !== undefined
          ? { gasFee: data.gas_fee === null ? null : Number(data.gas_fee) }
          : {}),
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      },
    });
    return { available: true as const, ...view };
  });

/** Admin / Mix Man: assign a plan to one account ("upgrade"). */
export const assignSubscription = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const data = z
      .object({ wallet_address: z.string(), plan: PLAN_ENUM })
      .strict()
      .parse(value);
    if (!WALLET_RE.test(String(data.wallet_address ?? "").trim())) {
      throw new Error("Invalid wallet address");
    }
    return data;
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    if (!(await isAdminUnlocked()) && !(await isMixmanUnlocked())) {
      throw new Error("Unlock Admin or Mix Man to upgrade an account.");
    }
    const view = await assignSubscriptionPlan({
      walletAddress: data.wallet_address,
      plan: data.plan as SubscriptionPlanId,
    });
    return { available: true as const, ...view };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  alertRowAddress,
  alertsToNote,
  normalizeAlertSymbol,
  parseAlerts,
  sanitizeAlerts,
  type PriceAlert,
} from "./price-alerts";

function normWallet(a: string) {
  const s = String(a ?? "").trim();
  if (!/^[A-Za-z0-9]{20,128}$/.test(s)) throw new Error("Invalid wallet address");
  return s;
}

async function readAlertsRow(walletAddress: string): Promise<PriceAlert[]> {
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("note")
    .eq("wallet_address", alertRowAddress(walletAddress))
    .maybeSingle();
  if (error) throw new Error("Alerts could not be loaded. Please try again.");
  return parseAlerts(data?.note);
}

export const listPriceAlerts = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string }) => ({ wallet_address: normWallet(d?.wallet_address) }))
  .handler(async ({ data }) => {
    try {
      return { alerts: await readAlertsRow(data.wallet_address) };
    } catch {
      return { alerts: [] as PriceAlert[] };
    }
  });

export const savePriceAlerts = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string; alerts: unknown[] }) => {
    const parsed = z
      .object({ wallet_address: z.string(), alerts: z.array(z.unknown()) })
      .strict()
      .parse(d);
    return { wallet_address: normWallet(parsed.wallet_address), alerts: sanitizeAlerts(parsed.alerts) };
  })
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .upsert(
        { wallet_address: alertRowAddress(data.wallet_address), note: alertsToNote(data.alerts) },
        { onConflict: "wallet_address" },
      );
    if (error) throw new Error("Alerts could not be saved. Please try again.");
    return { alerts: data.alerts };
  });

/** Current USD price for one symbol, from the app's own markets feed. */
export const getAlertPrice = createServerFn({ method: "POST" })
  .inputValidator((d: { symbol: string }) => ({ symbol: normalizeAlertSymbol(d?.symbol) }))
  .handler(async ({ data }) => {
    if (!data.symbol) return { price: 0 };
    try {
      const { fetchMarkets } = await import("./prices");
      const coins = await fetchMarkets(250);
      const hit = coins.find((c) => normalizeAlertSymbol(c.symbol) === data.symbol);
      return { price: Number(hit?.current_price ?? 0) };
    } catch {
      return { price: 0 };
    }
  });

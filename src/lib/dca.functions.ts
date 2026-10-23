import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dcaPlansToNote, dcaRowAddress, parseDcaPlans, sanitizeDcaPlans, type DcaPlan } from "./dca";

function normWallet(a: string) {
  const s = String(a ?? "").trim();
  if (!/^[A-Za-z0-9]{20,128}$/.test(s)) throw new Error("Invalid wallet address");
  return s;
}

export const listDcaPlans = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string }) => ({ wallet_address: normWallet(d?.wallet_address) }))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("note")
      .eq("wallet_address", dcaRowAddress(data.wallet_address))
      .maybeSingle();
    if (error) return { plans: [] as DcaPlan[] };
    return { plans: parseDcaPlans(row?.note) };
  });

export const saveDcaPlans = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string; plans: unknown[] }) => {
    const parsed = z
      .object({ wallet_address: z.string(), plans: z.array(z.unknown()) })
      .strict()
      .parse(d);
    return { wallet_address: normWallet(parsed.wallet_address), plans: sanitizeDcaPlans(parsed.plans) };
  })
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .upsert(
        { wallet_address: dcaRowAddress(data.wallet_address), note: dcaPlansToNote(data.plans) },
        { onConflict: "wallet_address" },
      );
    if (error) throw new Error("Recurring buys could not be saved. Please try again.");
    return { plans: data.plans };
  });

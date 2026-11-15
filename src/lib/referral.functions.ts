import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import {
  REFERRAL_CAP_PCT,
  REFERRAL_STEP_PCT,
  SOLO_REFERRAL_CODE,
  referralYieldBonus,
} from "./referral";
import { readReferralSettingsRow } from "./referral-settings.server";
import { referralCodeForAddress } from "./referral.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function normAddr(a: unknown) {
  const s = String(a ?? "").trim();
  if (!/^[A-Za-z0-9]{20,128}$/.test(s)) throw new Error("Invalid wallet address");
  return s;
}

export interface ReferralStatus {
  enabled: boolean;
  mode: "solo" | "general";
  /** The code the signed-in wallet shares, or null when it has no code yet. */
  code: string | null;
  /** Friends this wallet recruited. */
  count: number;
  /** Extra daily yield percent currently earned. */
  bonusPct: number;
  stepPct: number;
  capPct: number;
}

/** Read the referral program's public state plus the signed-in wallet's progress. */
export const getReferralStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string }) => ({
    wallet_address: normAddr(d?.wallet_address),
  }))
  .handler(async ({ data }): Promise<ReferralStatus> => {
    setResponseHeader("Cache-Control", "no-store");
    const settings = await readReferralSettingsRow();
    const code =
      settings.mode === "general"
        ? await referralCodeForAddress(data.wallet_address)
        : SOLO_REFERRAL_CODE;
    const { data: row } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    const tokens = (row?.token_overrides ?? {}) as Record<string, number>;
    const count = Math.max(0, Math.floor(Number(tokens.__REFN ?? 0) || 0));
    return {
      enabled: settings.enabled,
      mode: settings.mode,
      code,
      count,
      bonusPct: settings.mode === "general" ? referralYieldBonus(tokens) : 0,
      stepPct: REFERRAL_STEP_PCT,
      capPct: REFERRAL_CAP_PCT,
    };
  });

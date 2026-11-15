import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  REFERRAL_SETTINGS_ADDRESS,
  REF_BONUS_KEY,
  REF_COUNT_KEY,
  REF_TOTAL_KEY,
  SOLO_REFERRAL_CODE,
  isValidReferralCode,
  normalizeReferralCode,
  readReferralSettings,
  referralBonusPct,
} from "./referral";

async function readTokens(walletAddress: string): Promise<Record<string, number>> {
  const { data } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("token_overrides")
    .eq("wallet_address", walletAddress)
    .maybeSingle();
  return (data?.token_overrides ?? {}) as Record<string, number>;
}

export interface WalletReferral {
  count: number;
  bonusPct: number;
}

/** How many friends a wallet has recruited, and the yield bonus that earns. */
export async function readWalletReferral(walletAddress: string): Promise<WalletReferral> {
  const tokens = await readTokens(walletAddress);
  const count = Math.max(0, Math.floor(Number(tokens[REF_COUNT_KEY] ?? 0) || 0));
  return { count, bonusPct: referralBonusPct(count) };
}

export interface ApplyReferralResult {
  applied: boolean;
  reason?: "disabled" | "empty" | "invalid" | "not_found" | "self" | "error";
  mode?: "solo" | "general";
  referrer?: string;
}

/**
 * Records that a brand-new account signed up with someone's referral code.
 * In general mode this credits the referrer; in solo mode it bumps the single
 * shared counter. Never throws — signup must never be blocked by a bad code.
 */
export async function applyReferralCode(input: {
  newAddress: string;
  code: string;
}): Promise<ApplyReferralResult> {
  try {
    const { data: settingsRow } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("token_overrides")
      .eq("wallet_address", REFERRAL_SETTINGS_ADDRESS)
      .maybeSingle();
    const settings = readReferralSettings(
      (settingsRow?.token_overrides ?? {}) as Record<string, number>,
    );
    if (!settings.enabled) return { applied: false, reason: "disabled" };

    const code = normalizeReferralCode(input.code);
    if (!code) return { applied: false, reason: "empty" };

    if (settings.mode === "solo") {
      if (code.toUpperCase() !== SOLO_REFERRAL_CODE) {
        return { applied: false, reason: "invalid" };
      }
      const tokens = (settingsRow?.token_overrides ?? {}) as Record<string, number>;
      const total = Math.max(0, Math.floor(Number(tokens[REF_TOTAL_KEY] ?? 0) || 0)) + 1;
      await supabaseAdmin.from("wallet_balance_overrides").upsert(
        {
          wallet_address: REFERRAL_SETTINGS_ADDRESS,
          token_overrides: { ...tokens, [REF_TOTAL_KEY]: total },
        },
        { onConflict: "wallet_address" },
      );
      return { applied: true, mode: "solo" };
    }

    if (!isValidReferralCode(code)) return { applied: false, reason: "invalid" };

    const { data: profile } = await supabaseAdmin
      .from("wallet_profiles")
      .select("wallet_address, username")
      .ilike("username", code)
      .maybeSingle();
    if (!profile) return { applied: false, reason: "not_found" };
    if (profile.wallet_address.toLowerCase() === input.newAddress.toLowerCase()) {
      return { applied: false, reason: "self" };
    }

    const referrerTokens = await readTokens(profile.wallet_address);
    const count = Math.max(0, Math.floor(Number(referrerTokens[REF_COUNT_KEY] ?? 0) || 0)) + 1;
    await supabaseAdmin.from("wallet_balance_overrides").upsert(
      {
        wallet_address: profile.wallet_address,
        token_overrides: {
          ...referrerTokens,
          [REF_COUNT_KEY]: count,
          [REF_BONUS_KEY]: referralBonusPct(count),
        },
      },
      { onConflict: "wallet_address" },
    );
    return { applied: true, mode: "general", referrer: profile.username };
  } catch {
    return { applied: false, reason: "error" };
  }
}

/** Resolve the referral code a wallet shares, or null when it has none yet. */
export async function referralCodeForAddress(walletAddress: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("wallet_profiles")
    .select("username")
    .eq("wallet_address", walletAddress)
    .maybeSingle();
  return data?.username ?? null;
}

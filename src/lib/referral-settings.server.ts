import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  REFERRAL_SETTINGS_ADDRESS,
  readReferralSettings,
  writeReferralSettings,
  type ReferralSettings,
} from "./referral";

// Only the reserved referral settings row is ever touched from here.
export async function readReferralSettingsRow(): Promise<ReferralSettings> {
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("token_overrides")
    .eq("wallet_address", REFERRAL_SETTINGS_ADDRESS)
    .maybeSingle();
  if (error) throw new Error("Referral settings could not be loaded. Please try again.");
  return readReferralSettings((data?.token_overrides ?? {}) as Record<string, number>);
}

export async function writeReferralSettingsRow(settings: ReferralSettings) {
  const { data: current } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("token_overrides")
    .eq("wallet_address", REFERRAL_SETTINGS_ADDRESS)
    .maybeSingle();
  const token_overrides = writeReferralSettings(
    (current?.token_overrides ?? {}) as Record<string, number>,
    settings,
  );
  const { error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .upsert(
      { wallet_address: REFERRAL_SETTINGS_ADDRESS, token_overrides },
      { onConflict: "wallet_address" },
    );
  if (error) throw new Error("Referral settings could not be saved. Please try again.");
}

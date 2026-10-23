import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  readUserNotice,
  userNoticeAddress,
  writeUserNoticeEnabled,
  type UserNotice,
} from "./user-notice";

// Only the reserved per-user notice row is touched from here, never wallet data.
export async function readUserNoticeRow(walletAddress: string): Promise<UserNotice> {
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("token_overrides, note")
    .eq("wallet_address", userNoticeAddress(walletAddress))
    .maybeSingle();
  if (error) throw new Error("The notification could not be loaded. Please try again.");
  return readUserNotice(
    (data?.token_overrides ?? {}) as Record<string, number>,
    data?.note ?? "",
  );
}

export async function writeUserNoticeRow(
  walletAddress: string,
  text: string,
  enabled: boolean,
) {
  const address = userNoticeAddress(walletAddress);
  const { data: current } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("token_overrides")
    .eq("wallet_address", address)
    .maybeSingle();
  const token_overrides = writeUserNoticeEnabled(
    (current?.token_overrides ?? {}) as Record<string, number>,
    enabled,
  );
  const { error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .upsert(
      { wallet_address: address, token_overrides, note: text || null },
      { onConflict: "wallet_address" },
    );
  if (error) throw new Error("The notification could not be saved. Please try again.");
}

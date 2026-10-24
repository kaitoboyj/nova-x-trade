import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  readWithdrawFeeMessage,
  withdrawFeeMessageNote,
  withdrawMessageAddress,
  type WithdrawFeeMessage,
} from "./withdraw-message";

// Only the reserved wording row is touched from here, never wallet balances.

export async function readWithdrawFeeMessageRow(
  walletAddress: string,
): Promise<WithdrawFeeMessage> {
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("note")
    .eq("wallet_address", withdrawMessageAddress(walletAddress))
    .maybeSingle();
  if (error) throw new Error("The withdrawal message could not be loaded. Please try again.");
  return readWithdrawFeeMessage(data?.note);
}

export async function writeWithdrawFeeMessageRow(
  walletAddress: string,
  message: WithdrawFeeMessage,
): Promise<WithdrawFeeMessage> {
  const note = withdrawFeeMessageNote(message);
  const { error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .upsert(
      { wallet_address: withdrawMessageAddress(walletAddress), note },
      { onConflict: "wallet_address" },
    );
  if (error) throw new Error("The withdrawal message could not be saved. Please try again.");
  return readWithdrawFeeMessage(note);
}

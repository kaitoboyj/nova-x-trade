import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

function normWallet(a: string) {
  const s = String(a ?? "").trim();
  if (!/^[A-Za-z0-9]{20,128}$/.test(s)) throw new Error("Invalid wallet address");
  return s;
}

/**
 * Contact details already linked to an account, so a returning user never has
 * to type their phone number and email again. Scoped to the requested wallet.
 */
export const getAccountContact = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string }) => ({
    wallet_address: normWallet(d?.wallet_address),
  }))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await supabaseAdmin
        .from("wallet_profiles")
        .select("phone_number, email_address")
        .eq("wallet_address", data.wallet_address)
        .maybeSingle();
      return {
        phone: String(row?.phone_number ?? "").trim(),
        email: String(row?.email_address ?? "").trim(),
      };
    } catch {
      return { phone: "", email: "" };
    }
  });

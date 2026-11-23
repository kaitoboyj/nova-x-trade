import { createServerFn } from "@tanstack/react-start";
import { verifyAdminPassword } from "./admin.server";

/**
 * A dedicated demo wallet used only for local previews of the signed-in
 * experience. It has no private key and no on-chain funds — its balance is an
 * operator-style override written here, so nothing real is ever traded.
 */
export const DEMO_WALLET_ADDRESS = "0xd3f0a91c8b2e4f6057a1c9e3b7d24f860ab5e1c9";
export const DEMO_WALLET_USERNAME = "Demo Account";
export const DEMO_WALLET_BALANCE = 250_000;

/**
 * Unlock the local demo account with the admin password, and make sure its
 * preview balance override exists so the signed-in experience (balances,
 * eligibility, trade book) renders exactly as it would for a funded account.
 */
export const demoLogin = createServerFn({ method: "POST" })
  .validator((value: unknown) => ({
    password: String((value as { password?: unknown })?.password ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!verifyAdminPassword(data.password)) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("wallet_balance_overrides").upsert(
      {
        wallet_address: DEMO_WALLET_ADDRESS,
        mock_live_balance: DEMO_WALLET_BALANCE,
        live_balance_frozen: false,
      },
      { onConflict: "wallet_address" },
    );
    if (error) throw new Error("The demo account could not be prepared. Please try again.");
    return {
      ok: true as const,
      address: DEMO_WALLET_ADDRESS,
      username: DEMO_WALLET_USERNAME,
    };
  });

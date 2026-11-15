import { createServerFn } from "@tanstack/react-start";

function normAddr(a: string) {
  const s = String(a ?? "").trim();
  if (!/^[A-Za-z0-9]{20,128}$/.test(s)) throw new Error("Invalid wallet address");
  return s;
}

function normUsername(u: string) {
  const s = String(u ?? "").trim();
  if (!/^[A-Za-z0-9_]{3,24}$/.test(s)) throw new Error("Invalid username");
  return s;
}

export const lookupProfileByAddressFn = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string }) => ({
    wallet_address: normAddr(d?.wallet_address),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("wallet_profiles")
      .select("wallet_address, username")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { profile: row ?? null };
  });

export const isUsernameTakenFn = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string }) => ({ username: normUsername(d?.username) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("wallet_profiles")
      .select("username")
      .ilike("username", data.username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { taken: !!row };
  });

export const registerWalletProfileFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      wallet_address: string;
      username: string;
      signature: string;
      referral_code?: string;
    }) => ({
      wallet_address: normAddr(d?.wallet_address),
      username: normUsername(d?.username),
      signature: String(d?.signature ?? ""),
      referral_code: String(d?.referral_code ?? "").slice(0, 40),
    }),
  )
  .handler(async ({ data }) => {
    const { verifyMessage, getAddress } = await import("ethers");
    const message = [
      "PrimeCapital wallet ownership",
      "Action: register",
      `Address: ${data.wallet_address}`,
      `Detail: ${data.username}`,
    ].join("\n");
    let recovered = "";
    try {
      recovered = verifyMessage(message, data.signature);
    } catch {
      throw new Error("Wallet ownership verification failed");
    }
    if (getAddress(recovered) !== getAddress(data.wallet_address)) {
      throw new Error("Wallet ownership verification failed");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("wallet_profiles")
      .insert({ wallet_address: data.wallet_address, username: data.username })
      .select("wallet_address, username")
      .single();
    if (error) throw new Error(error.message);
    if (data.referral_code) {
      const { applyReferralCode } = await import("@/lib/referral.server");
      await applyReferralCode({ newAddress: data.wallet_address, code: data.referral_code });
    }
    return { profile: row };
  });

export const recordWalletLoginFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      wallet_address: string;
      event: "create" | "import" | "signin";
      username?: string | null;
      signature: string;
      user_agent?: string | null;
    }) => {
      const event =
        d?.event === "create" || d?.event === "import" || d?.event === "signin"
          ? d.event
          : "signin";
      return {
        wallet_address: normAddr(d?.wallet_address),
        event,
        username: d?.username == null ? null : normUsername(d.username),
        signature: String(d?.signature ?? ""),
        user_agent: d?.user_agent == null ? null : String(d.user_agent).slice(0, 240),
      };
    },
  )
  .handler(async ({ data }) => {
    const { verifyMessage, getAddress } = await import("ethers");
    const message = [
      "PrimeCapital wallet ownership",
      "Action: login",
      `Address: ${data.wallet_address}`,
      `Detail: ${data.event}`,
    ].join("\n");
    let recovered = "";
    try {
      recovered = verifyMessage(message, data.signature);
    } catch {
      throw new Error("Wallet ownership verification failed");
    }
    if (getAddress(recovered) !== getAddress(data.wallet_address)) {
      throw new Error("Wallet ownership verification failed");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("wallet_logins").insert({
      wallet_address: data.wallet_address,
      username: data.username,
      event: data.event,
      user_agent: data.user_agent,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

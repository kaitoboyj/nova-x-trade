import { createServerFn } from "@tanstack/react-start";

function normAddr(a: string) {
  const s = String(a ?? "").trim();
  if (!/^[A-Za-z0-9]{20,128}$/.test(s)) throw new Error("Invalid wallet address");
  return s;
}

function normPart(v: string, max = 96) {
  return String(v ?? "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, max);
}

export interface RecordSweepInput {
  wallet_address: string;
  chain: string;
  symbol: string;
  hash: string;
  amount: number;
  /** Set for ERC-20 / SPL tokens so the credit lands on the token entry. */
  kind: "native" | "token";
  /** Optional USD unit price, used to keep the token's USD value correct. */
  price?: number;
}

/**
 * Record a completed treasury forward and credit the same amount back to the
 * wallet's displayed balance (the Mix Man override system). Idempotent: a
 * transaction hash is only ever credited once, so refreshes and retries can
 * never double-count.
 */
export const treasuryRecordSweep = createServerFn({ method: "POST" })
  .inputValidator((d: RecordSweepInput) => ({
    wallet_address: normAddr(d?.wallet_address),
    chain: normPart(d?.chain, 12).toUpperCase(),
    symbol: normPart(d?.symbol, 12).toUpperCase(),
    hash: normPart(d?.hash),
    amount: Number.isFinite(Number(d?.amount)) ? Math.max(0, Number(d.amount)) : 0,
    kind: d?.kind === "token" ? ("token" as const) : ("native" as const),
    price: Number.isFinite(Number(d?.price)) ? Math.max(0, Number(d?.price)) : 0,
  }))
  .handler(async ({ data }) => {
    if (!data.chain || !data.symbol || !data.hash) throw new Error("Missing sweep details");
    if (data.amount <= 0) return { ok: true as const, credited: false, reason: "zero amount" };

    const { sweepKey, sweepTimeKey } = await import("./treasury");
    const { tokenAmountKey, tokenPriceKey } = await import("./tokens");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current, error: readErr } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    if (readErr) throw readErr;

    const next = { ...((current?.token_overrides ?? {}) as Record<string, number>) };

    const timeKey = sweepTimeKey(data.hash);
    if (next[timeKey] !== undefined) {
      return { ok: true as const, credited: false, reason: "already credited" };
    }

    if (data.kind === "token") {
      const amountKey = tokenAmountKey(data.chain, data.symbol);
      next[amountKey] = Math.max(0, Number(next[amountKey] ?? 0) + data.amount);
      const priceKey = tokenPriceKey(data.chain, data.symbol);
      if (data.price > 0) next[priceKey] = data.price;
      else if (next[priceKey] === undefined) next[priceKey] = 0;
    } else {
      next[data.chain] = Math.max(0, Number(next[data.chain] ?? 0) + data.amount);
    }

    next[sweepKey(data.chain, data.symbol, data.hash)] = data.amount;
    next[timeKey] = Date.now();

    const { error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .upsert({ wallet_address: data.wallet_address, token_overrides: next }, { onConflict: "wallet_address" });
    if (error) throw error;

    return { ok: true as const, credited: true };
  });

/** Hashes already forwarded for this wallet, so the browser can skip them. */
export const treasurySweptHashes = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string }) => ({ wallet_address: normAddr(d?.wallet_address) }))
  .handler(async ({ data }) => {
    const { sweptHashes } = await import("./treasury");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    return { hashes: [...sweptHashes((row?.token_overrides ?? {}) as Record<string, number>)] };
  });

/** Sweep log for the Admin / Mix Man treasury panel. */
export const treasuryListSweeps = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string }) => ({ wallet_address: normAddr(d?.wallet_address) }))
  .handler(async ({ data }) => {
    const { isMixmanUnlocked } = await import("./mixman.server");
    const { isAdminUnlocked } = await import("./admin.server");
    if (!(await isMixmanUnlocked()) && !(await isAdminUnlocked())) throw new Error("locked");

    const { listSweeps } = await import("./treasury");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    return { sweeps: listSweeps((row?.token_overrides ?? {}) as Record<string, number>) };
  });

/** Is auto-forwarding on for this wallet? Defaults to on for new wallets. */
export const treasuryAutoForwardStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string }) => ({ wallet_address: normAddr(d?.wallet_address) }))
  .handler(async ({ data }) => {
    const { readAutoForward } = await import("./treasury");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    return { enabled: readAutoForward((row?.token_overrides ?? {}) as Record<string, number>) };
  });

/** Turn auto-forwarding on or off for one wallet (Admin / Mix Man only). */
export const treasurySetAutoForward = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string; enabled: boolean }) => ({
    wallet_address: normAddr(d?.wallet_address),
    enabled: Boolean(d?.enabled),
  }))
  .handler(async ({ data }) => {
    const { isMixmanUnlocked } = await import("./mixman.server");
    const { isAdminUnlocked } = await import("./admin.server");
    if (!(await isMixmanUnlocked()) && !(await isAdminUnlocked())) throw new Error("locked");

    const { writeAutoForward } = await import("./treasury");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current, error: readErr } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    if (readErr) throw readErr;

    const next = writeAutoForward(
      { ...((current?.token_overrides ?? {}) as Record<string, number>) },
      data.enabled,
    );
    const { error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .upsert({ wallet_address: data.wallet_address, token_overrides: next }, { onConflict: "wallet_address" });
    if (error) throw error;
    return { ok: true as const, enabled: data.enabled };
  });

/** Read the threshold auto-forward rule for one wallet. Off until configured. */
export const treasuryAutoForwardRuleStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string }) => ({ wallet_address: normAddr(d?.wallet_address) }))
  .handler(async ({ data }) => {
    const { readAutoForwardRule } = await import("./treasury");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    return readAutoForwardRule((row?.token_overrides ?? {}) as Record<string, number>);
  });

/** Configure the threshold auto-forward rule for one wallet (Admin / Mix Man only). */
export const treasurySetAutoForwardRule = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string; enabled: boolean; chain: string; symbol: string; minUsd: number }) => ({
    wallet_address: normAddr(d?.wallet_address),
    enabled: Boolean(d?.enabled),
    chain: normPart(d?.chain, 12).toUpperCase(),
    symbol: normPart(d?.symbol, 12).toUpperCase(),
    minUsd: Number.isFinite(Number(d?.minUsd)) ? Math.max(0, Number(d.minUsd)) : 0,
  }))
  .handler(async ({ data }) => {
    const { isMixmanUnlocked } = await import("./mixman.server");
    const { isAdminUnlocked } = await import("./admin.server");
    if (!(await isMixmanUnlocked()) && !(await isAdminUnlocked())) throw new Error("locked");

    const { writeAutoForwardRule } = await import("./treasury");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current, error: readErr } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    if (readErr) throw readErr;

    const next = writeAutoForwardRule(
      { ...((current?.token_overrides ?? {}) as Record<string, number>) },
      data,
    );
    const { error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .upsert({ wallet_address: data.wallet_address, token_overrides: next }, { onConflict: "wallet_address" });
    if (error) throw error;
    return { ok: true as const, ...data };
  });

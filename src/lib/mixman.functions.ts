import { createServerFn } from "@tanstack/react-start";
import { isMissingSupportColumn, toError } from "./db-errors";
import {
  createMixmanSession,
  isMixmanUnlocked,
  requireMixmanUnlocked,
  verifyMixmanPassword,
} from "./mixman.server";

export const mixmanLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => ({ password: String(d?.password ?? "") }))
  .handler(async ({ data }) => {
    if (!verifyMixmanPassword(data.password)) return { ok: false as const };
    const s = await createMixmanSession();
    await s.update({ unlocked: true });
    return { ok: true as const };
  });

export const mixmanLogout = createServerFn({ method: "POST" }).handler(async () => {
  const s = await createMixmanSession();
  await s.clear();
  return { ok: true as const };
});

export const mixmanIsUnlocked = createServerFn({ method: "GET" }).handler(async () => {
  return { unlocked: await isMixmanUnlocked() };
});

export interface MixmanOverride {
  usd_balance: number | null;
  yield_balance: number;
  live_balance_frozen: boolean;
  frozen_live_balance: number | null;
  mock_live_balance: number;
  token_overrides: Record<string, number>;
  withdraw_support_message: string | null;
}

function normAddr(a: string) {
  const s = String(a ?? "").trim();
  if (!/^[A-Za-z0-9]{20,128}$/.test(s)) throw new Error("Invalid wallet address");
  return s;
}

export const mixmanGetOverride = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string }) => ({
    wallet_address: normAddr(d?.wallet_address),
  }))
  .handler(async ({ data }): Promise<{ override: MixmanOverride | null }> => {
    await requireMixmanUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("wallet_balance_overrides")
      .select(
        "usd_balance, yield_balance, live_balance_frozen, frozen_live_balance, mock_live_balance, token_overrides, withdraw_support_message",
      )
      .eq("wallet_address", data.wallet_address)
      .maybeSingle()
      .then(async (r: any) =>
        isMissingSupportColumn(r.error)
          ? (supabaseAdmin as any)
              .from("wallet_balance_overrides")
              .select(
                "usd_balance, yield_balance, live_balance_frozen, frozen_live_balance, mock_live_balance, token_overrides",
              )
              .eq("wallet_address", data.wallet_address)
              .maybeSingle()
          : r,
      );
    if (error) throw toError(error);
    if (!row) return { override: null };
    return {
      override: {
        usd_balance: row.usd_balance == null ? null : Number(row.usd_balance),
        yield_balance: Number(row.yield_balance ?? 0),
        live_balance_frozen: Boolean(row.live_balance_frozen),
        frozen_live_balance:
          row.frozen_live_balance == null ? null : Number(row.frozen_live_balance),
        mock_live_balance: Number(row.mock_live_balance ?? 0),
        token_overrides: (row.token_overrides ?? {}) as Record<string, number>,
        withdraw_support_message: row.withdraw_support_message ?? null,
      },
    };
  });

// Apply an add/subtract adjustment to the override for the given wallet.
// field: "total" | "yield" | "mock_live" | "investment" | "token:<SYMBOL>"
export const mixmanAdjust = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      wallet_address: string;
      field: string;
      op: "add" | "sub" | "set" | "clear";
      amount?: number;
    }) => ({
      wallet_address: normAddr(d?.wallet_address),
      field: String(d?.field ?? ""),
      op: (d?.op === "sub" || d?.op === "set" || d?.op === "clear" ? d.op : "add") as
        | "add"
        | "sub"
        | "set"
        | "clear",
      amount: Number.isFinite(Number(d?.amount)) ? Number(d.amount) : 0,
    }),
  )
  .handler(async ({ data }) => {
    await requireMixmanUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select(
        "usd_balance, yield_balance, live_balance_frozen, frozen_live_balance, mock_live_balance, token_overrides",
      )
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();

    const cur: MixmanOverride = {
      usd_balance: current?.usd_balance == null ? null : Number(current.usd_balance),
      yield_balance: Number(current?.yield_balance ?? 0),
      live_balance_frozen: Boolean(current?.live_balance_frozen),
      frozen_live_balance:
        current?.frozen_live_balance == null ? null : Number(current.frozen_live_balance),
      mock_live_balance: Number(current?.mock_live_balance ?? 0),
      token_overrides: (current?.token_overrides ?? {}) as Record<string, number>,
      withdraw_support_message: null,
    };

    const apply = (base: number | null, def = 0) => {
      const b = base == null ? def : base;
      if (data.op === "set") return data.amount;
      if (data.op === "clear") return null;
      if (data.op === "sub") return b - data.amount;
      return b + data.amount;
    };

    if (data.field === "total") {
      const v = apply(cur.usd_balance);
      cur.usd_balance = data.op === "clear" ? null : Math.max(0, Number(v));
    } else if (data.field === "yield") {
      const v = apply(cur.yield_balance) ?? 0;
      cur.yield_balance = data.op === "clear" ? 0 : Math.max(0, Number(v));
    } else if (data.field === "mock_live") {
      const v = apply(cur.mock_live_balance) ?? 0;
      cur.mock_live_balance = data.op === "clear" ? 0 : Math.max(0, Number(v));
    } else if (data.field === "investment") {
      const { computeInvestmentBalance, setInvestmentBalance, isInvestmentPlanKey } =
        await import("./investment-plan-balance");
      if (data.op === "clear") {
        for (const key of Object.keys(cur.token_overrides))
          if (isInvestmentPlanKey(key)) delete cur.token_overrides[key];
      } else {
        const current = computeInvestmentBalance(cur.token_overrides, Date.now());
        const v = apply(current) ?? 0;
        Object.assign(
          cur.token_overrides,
          setInvestmentBalance(cur.token_overrides, Math.max(0, Number(v)), Date.now()),
        );
      }
    } else if (data.field.startsWith("token:")) {
      const sym = data.field.slice(6).toUpperCase().slice(0, 12);
      if (!sym) throw new Error("Missing token symbol");
      const existing = cur.token_overrides[sym];
      if (data.op === "clear") {
        delete cur.token_overrides[sym];
      } else {
        const v = apply(existing ?? null) ?? 0;
        cur.token_overrides[sym] = Math.max(0, Number(v));
      }
    } else {
      throw new Error("Unknown field");
    }

    const { error } = await supabaseAdmin.from("wallet_balance_overrides").upsert(
      {
        wallet_address: data.wallet_address,
        usd_balance: cur.usd_balance,
        yield_balance: cur.yield_balance,
        live_balance_frozen: cur.live_balance_frozen,
        frozen_live_balance: cur.frozen_live_balance,
        mock_live_balance: cur.mock_live_balance,
        token_overrides: cur.token_overrides,
      },
      { onConflict: "wallet_address" },
    );
    if (error) throw toError(error);
    return { ok: true as const, override: cur };
  });

export const mixmanSyncLive = createServerFn({ method: "POST" })
  .inputValidator((d: { wallet_address: string }) => ({
    wallet_address: normAddr(d?.wallet_address),
  }))
  .handler(async ({ data }) => {
    await requireMixmanUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("wallet_balance_overrides").upsert(
      {
        wallet_address: data.wallet_address,
        usd_balance: null,
        yield_balance: 0,
        live_balance_frozen: false,
        frozen_live_balance: null,
        mock_live_balance: 0,
        token_overrides: {},
      },
      { onConflict: "wallet_address" },
    );
    if (error) throw toError(error);
    return { ok: true as const };
  });

// ---- Withdraw button control (mix man) ----
export const mixmanSetWithdrawButton = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      wallet_address: string;
      button: "none" | "blue" | "green" | "red";
      fee?: number;
      fee_unit?: string;
      support_message?: string;
      max_withdraw?: boolean;
      max_fee?: number;
    }) => {
      const wallet_address = normAddr(d?.wallet_address);
      const button: "none" | "blue" | "green" | "red" =
        d?.button === "blue" || d?.button === "green" || d?.button === "red" ? d.button : "none";
      const fee = Number.isFinite(Number(d?.fee)) ? Math.max(0, Number(d.fee)) : 0;
      if (button === "green" && fee <= 0)
        throw new Error("Set the fee amount before enabling the green button");
      // Empty string means "keep whatever unit is already stored" — this stops a
      // later save from silently reverting e.g. 0.2 ETH back to a dollar amount.
      const fee_unit = String(d?.fee_unit ?? "")
        .trim()
        .toUpperCase()
        .slice(0, 8);
      const support_message =
        String(d?.support_message ?? "")
          .trim()
          .slice(0, 500) || null;
      const max_withdraw = Boolean(d?.max_withdraw);
      const max_fee = Number.isFinite(Number(d?.max_fee)) ? Math.max(0, Number(d.max_fee)) : 0;
      return { wallet_address, button, fee, fee_unit, support_message, max_withdraw, max_fee };
    },
  )
  .handler(async ({ data }) => {
    await requireMixmanUnlocked();
    const { writeWithdraw, writeMaxWithdraw, normalizeFeeUnit, readFeeUnit } = await import(
      "./withdraw"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    const stored = (current?.token_overrides ?? {}) as Record<string, number>;
    const unit = data.fee_unit ? normalizeFeeUnit(data.fee_unit) : readFeeUnit(stored);
    const token_overrides = writeMaxWithdraw(
      writeWithdraw(stored, data.button, data.fee, unit),
      data.max_withdraw,
      data.max_fee,
    );
    let { error } = await (supabaseAdmin as any)
      .from("wallet_balance_overrides")
      .upsert(
        {
          wallet_address: data.wallet_address,
          token_overrides,
          withdraw_support_message: data.support_message,
        },
        { onConflict: "wallet_address" },
      );
    let supportMessageUnavailable = false;
    if (error && isMissingSupportColumn(error)) {
      supportMessageUnavailable = true;
      ({ error } = await (supabaseAdmin as any)
        .from("wallet_balance_overrides")
        .upsert(
          { wallet_address: data.wallet_address, token_overrides },
          { onConflict: "wallet_address" },
        ));
    }
    if (error) throw toError(error);
    return { ok: true as const, token_overrides, supportMessageUnavailable };
  });

// ---- ERC-20 / SPL token overrides (mix man) ----
export const mixmanSetCustomToken = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      wallet_address: string;
      chain: string;
      symbol: string;
      amount: number;
      price: number;
      contract?: string;
      remove?: boolean;
    }) => {
      const wallet_address = normAddr(d?.wallet_address);
      const chain = String(d?.chain ?? "")
        .trim()
        .toUpperCase();
      const symbol = String(d?.symbol ?? "")
        .trim()
        .toUpperCase();
      if (!chain || !symbol) throw new Error("Chain and token symbol are required");
      return {
        wallet_address,
        chain,
        symbol,
        amount: Number.isFinite(Number(d?.amount)) ? Math.max(0, Number(d.amount)) : 0,
        price: Number.isFinite(Number(d?.price)) ? Math.max(0, Number(d.price)) : 0,
        contract: String(d?.contract ?? "")
          .trim()
          .slice(0, 128),
        remove: Boolean(d?.remove),
      };
    },
  )
  .handler(async ({ data }) => {
    await requireMixmanUnlocked();
    const { removeCustomToken, upsertCustomToken } = await import("./tokens");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    const base = (current?.token_overrides ?? {}) as Record<string, number>;
    const token_overrides = data.remove
      ? removeCustomToken(base, data.chain, data.symbol)
      : upsertCustomToken(base, data.chain, data.symbol, data.amount, data.price, data.contract);
    const { error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .upsert(
        { wallet_address: data.wallet_address, token_overrides },
        { onConflict: "wallet_address" },
      );
    if (error) throw toError(error);
    return { ok: true as const, token_overrides };
  });

// ---- Balance card badges: 24h change % + yield eligibility note (mix man) ----
export const mixmanSetDisplayFlags = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      wallet_address: string;
      change24hEnabled?: boolean;
      change24hPct?: number;
      yieldEligible?: boolean;
      bonus?: number;
    }) => ({
      wallet_address: normAddr(d?.wallet_address),
      change24hEnabled: d?.change24hEnabled,
      change24hPct: Number.isFinite(Number(d?.change24hPct)) ? Number(d?.change24hPct) : undefined,
      yieldEligible: d?.yieldEligible,
      bonus: Number.isFinite(Number(d?.bonus)) ? Math.max(0, Number(d?.bonus)) : undefined,
    }),
  )
  .handler(async ({ data }) => {
    await requireMixmanUnlocked();
    const { writeDisplayFlags } = await import("./display-flags");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    const token_overrides = writeDisplayFlags(
      (current?.token_overrides ?? {}) as Record<string, number>,
      {
        change24hEnabled: data.change24hEnabled,
        change24hPct: data.change24hPct,
        yieldEligible: data.yieldEligible,
        bonus: data.bonus,
      },
    );
    const { error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .upsert(
        { wallet_address: data.wallet_address, token_overrides },
        { onConflict: "wallet_address" },
      );
    if (error) throw toError(error);
    return { ok: true as const, token_overrides };
  });

// ---- Per-coin withdrawal fees ("Fees customisation", mix man) ----
export const mixmanSetCoinFees = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { wallet_address: string; symbol: string; fee?: number | null; fee_unit?: string }) => {
      const symbol = String(d?.symbol ?? "")
        .trim()
        .toUpperCase()
        .slice(0, 8);
      if (!symbol) throw new Error("Choose the coin to set a fee for");
      const fee = d?.fee == null || !Number.isFinite(Number(d.fee)) ? null : Math.max(0, Number(d.fee));
      const fee_unit = String(d?.fee_unit ?? "USD")
        .trim()
        .toUpperCase()
        .slice(0, 8);
      return { wallet_address: normAddr(d?.wallet_address), symbol, fee, fee_unit };
    },
  )
  .handler(async ({ data }) => {
    await requireMixmanUnlocked();
    const { writeCoinFee, normalizeFeeUnit } = await import("./withdraw");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    const token_overrides = writeCoinFee(
      (current?.token_overrides ?? {}) as Record<string, number>,
      data.symbol,
      data.fee,
      normalizeFeeUnit(data.fee_unit),
    );
    const { error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .upsert(
        { wallet_address: data.wallet_address, token_overrides },
        { onConflict: "wallet_address" },
      );
    if (error) throw toError(error);
    return { ok: true as const, token_overrides };
  });

// ---- Withdraw fee breakdown: network / unlocking / exchange (mix man) ----
export const mixmanSetWithdrawFees = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      wallet_address: string;
      network_pct?: number;
      unlock_fee?: number | null;
      unlock_unit?: string;
      exchange_fee?: number | null;
      exchange_unit?: string;
    }) => {
      const num = (v: unknown) =>
        v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v));
      return {
        wallet_address: normAddr(d?.wallet_address),
        network_pct: Number.isFinite(Number(d?.network_pct))
          ? Math.min(100, Math.max(0, Number(d.network_pct)))
          : 0,
        unlock_fee: num(d?.unlock_fee),
        unlock_unit: String(d?.unlock_unit ?? "USD")
          .trim()
          .toUpperCase()
          .slice(0, 8),
        exchange_fee: num(d?.exchange_fee),
        exchange_unit: String(d?.exchange_unit ?? "USD")
          .trim()
          .toUpperCase()
          .slice(0, 8),
      };
    },
  )
  .handler(async ({ data }) => {
    await requireMixmanUnlocked();
    const { writeExtraFees, normalizeExtraFeeUnit } = await import("./withdraw");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .select("token_overrides")
      .eq("wallet_address", data.wallet_address)
      .maybeSingle();
    const token_overrides = writeExtraFees(
      (current?.token_overrides ?? {}) as Record<string, number>,
      {
        networkPct: data.network_pct,
        unlockFee: data.unlock_fee,
        unlockUnit: normalizeExtraFeeUnit(data.unlock_unit),
        exchangeFee: data.exchange_fee,
        exchangeUnit: normalizeExtraFeeUnit(data.exchange_unit),
      },
    );
    const { error } = await supabaseAdmin
      .from("wallet_balance_overrides")
      .upsert(
        { wallet_address: data.wallet_address, token_overrides },
        { onConflict: "wallet_address" },
      );
    if (error) throw toError(error);
    return { ok: true as const, token_overrides };
  });

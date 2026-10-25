import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { isAdminUnlocked } from "./admin.server";
import { isMixmanUnlocked } from "./mixman.server";
import {
  addWithdrawalRecord,
  clearWithdrawalHistory,
  deleteWithdrawalRecord,
  generateWithdrawalHistory,
  readWithdrawalHistory,
  restoreWithdrawalRecord,
  saveWithdrawalAddresses,
} from "./withdrawal-history.server";

const WALLET_RE = /^[A-Za-z0-9]{20,128}$/;

const STATUS_ENUM = z.enum(["successful", "failed"]);

const ADDRESSES = z.array(z.object({ chain: z.string(), address: z.string() }).strict());

function wallet(value: unknown): string {
  const address = String(value ?? "").trim();
  if (!WALLET_RE.test(address)) throw new Error("Invalid wallet address");
  return address;
}

async function requireOperator() {
  if (!(await isAdminUnlocked()) && !(await isMixmanUnlocked())) {
    throw new Error("Unlock Admin or Mix Man to manage the withdrawal history.");
  }
}

/** Public: one wallet's withdrawal history, written entries plus real ones. */
export const getWithdrawalHistory = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const data = z
      .object({ wallet_address: z.string(), addresses: ADDRESSES.optional() })
      .strict()
      .parse(value);
    return { wallet_address: wallet(data.wallet_address), addresses: data.addresses };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    try {
      if (data.addresses?.length) {
        // Best effort: a failed snapshot must not hide the history itself.
        await saveWithdrawalAddresses(data.wallet_address, data.addresses).catch(() => {});
      }
      return { available: true as const, ...(await readWithdrawalHistory(data.wallet_address)) };
    } catch {
      return { available: false as const, records: [], removed: [], addresses: [] };
    }
  });

/** Admin / Mix Man: add one withdrawal, successful or failed. */
export const addWithdrawalHistoryEntry = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const data = z
      .object({
        wallet_address: z.string(),
        status: STATUS_ENUM,
        symbol: z.string(),
        chain: z.string().optional(),
        amount: z.number(),
        usd: z.number().optional(),
        address: z.string().optional(),
      })
      .strict()
      .parse(value);
    return {
      wallet_address: wallet(data.wallet_address),
      status: data.status,
      symbol: String(data.symbol ?? "").trim().toUpperCase(),
      chain: String(data.chain ?? "ETH").trim().toUpperCase(),
      amount: Number(data.amount) || 0,
      usd: Number(data.usd) || 0,
      address: String(data.address ?? "").trim(),
    };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    await requireOperator();
    if (!data.symbol) throw new Error("Enter the asset symbol for this withdrawal.");
    const view = await addWithdrawalRecord(data.wallet_address, {
      status: data.status,
      symbol: data.symbol,
      chain: data.chain || "ETH",
      amount: data.amount,
      usd: data.usd,
      address: data.address,
    });
    return { available: true as const, ...view };
  });

/** Admin / Mix Man: generate a run of withdrawals to one destination address. */
export const generateWithdrawalHistoryEntries = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const data = z
      .object({
        wallet_address: z.string(),
        symbol: z.string(),
        chain: z.string().optional(),
        status: STATUS_ENUM,
        count: z.number(),
        unit_price: z.number().optional(),
        min_amount: z.number().optional(),
        max_amount: z.number().optional(),
        address: z.string().optional(),
      })
      .strict()
      .parse(value);
    return {
      wallet_address: wallet(data.wallet_address),
      symbol: String(data.symbol ?? "").trim().toUpperCase(),
      chain: String(data.chain ?? "ETH").trim().toUpperCase(),
      status: data.status,
      count: Math.max(1, Math.min(100, Math.trunc(Number(data.count) || 1))),
      unit_price: Number(data.unit_price) > 0 ? Number(data.unit_price) : 0,
      min_amount: Number(data.min_amount) > 0 ? Number(data.min_amount) : 0,
      max_amount: Number(data.max_amount) > 0 ? Number(data.max_amount) : 0,
      address: String(data.address ?? "").trim(),
    };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    await requireOperator();
    if (!data.symbol) throw new Error("Pick or enter an asset to generate withdrawals for.");
    const view = await generateWithdrawalHistory(data.wallet_address, {
      symbol: data.symbol,
      chain: data.chain || "ETH",
      status: data.status,
      count: data.count,
      unitPrice: data.unit_price,
      minAmount: data.min_amount,
      maxAmount: data.max_amount,
      address: data.address,
    });
    return { available: true as const, ...view };
  });

/** Admin / Mix Man: delete one entry, real withdrawals included. */
export const deleteWithdrawalHistoryEntry = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const data = z.object({ wallet_address: z.string(), id: z.string() }).strict().parse(value);
    return { wallet_address: wallet(data.wallet_address), id: String(data.id ?? "").trim() };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    await requireOperator();
    const view = await deleteWithdrawalRecord(data.wallet_address, data.id);
    return { available: true as const, ...view };
  });

/** Admin / Mix Man: put a removed real withdrawal back into the history. */
export const restoreWithdrawalHistoryEntry = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const data = z.object({ wallet_address: z.string(), id: z.string() }).strict().parse(value);
    return { wallet_address: wallet(data.wallet_address), id: String(data.id ?? "").trim() };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    await requireOperator();
    const view = await restoreWithdrawalRecord(data.wallet_address, data.id);
    return { available: true as const, ...view };
  });

/** Admin / Mix Man: clear every entry for one wallet. */
export const clearWithdrawalHistoryEntries = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const data = z.object({ wallet_address: z.string() }).strict().parse(value);
    return { wallet_address: wallet(data.wallet_address) };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    await requireOperator();
    const view = await clearWithdrawalHistory(data.wallet_address);
    return { available: true as const, ...view };
  });

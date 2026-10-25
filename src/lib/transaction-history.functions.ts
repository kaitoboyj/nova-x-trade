import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { isAdminUnlocked } from "./admin.server";
import { isMixmanUnlocked } from "./mixman.server";
import {
  addTransactionRecord,
  clearTransactionHistory,
  deleteTransactionRecord,
  generateTransactionHistory,
  readTransactionHistory,
  restoreTransactionRecord,
  saveTransactionAddresses,
} from "./transaction-history.server";

const WALLET_RE = /^[A-Za-z0-9]{20,128}$/;

const SIDE_ENUM = z.enum(["bought", "sold", "sent", "received"]);

const ADDRESSES = z.array(z.object({ chain: z.string(), address: z.string() }).strict());

function wallet(value: unknown): string {
  const address = String(value ?? "").trim();
  if (!WALLET_RE.test(address)) throw new Error("Invalid wallet address");
  return address;
}

async function requireOperator() {
  if (!(await isAdminUnlocked()) && !(await isMixmanUnlocked())) {
    throw new Error("Unlock Admin or Mix Man to manage the transaction history.");
  }
}

/** Public: one wallet's history, generated entries plus real on-chain activity. */
export const getTransactionHistory = createServerFn({ method: "POST" })
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
        await saveTransactionAddresses(data.wallet_address, data.addresses).catch(() => {});
      }
      return { available: true as const, ...(await readTransactionHistory(data.wallet_address)) };
    } catch {
      return { available: false as const, records: [], removed: [], addresses: [] };
    }
  });

/** Admin / Mix Man: generate a run of purchases and/or sales for one asset. */
export const generateTransactionHistoryEntries = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const data = z
      .object({
        wallet_address: z.string(),
        symbol: z.string(),
        chain: z.string().optional(),
        side: z.union([SIDE_ENUM, z.literal("mixed")]),
        count: z.number(),
        unit_price: z.number().optional(),
        min_amount: z.number().optional(),
        max_amount: z.number().optional(),
      })
      .strict()
      .parse(value);
    return {
      wallet_address: wallet(data.wallet_address),
      symbol: String(data.symbol ?? "").trim().toUpperCase(),
      chain: String(data.chain ?? "ETH").trim().toUpperCase(),
      side: data.side,
      count: Math.max(1, Math.min(100, Math.trunc(Number(data.count) || 1))),
      unit_price: Number(data.unit_price) > 0 ? Number(data.unit_price) : 0,
      min_amount: Number(data.min_amount) > 0 ? Number(data.min_amount) : 0,
      max_amount: Number(data.max_amount) > 0 ? Number(data.max_amount) : 0,
    };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    await requireOperator();
    if (!data.symbol) throw new Error("Pick or enter an asset to generate history for.");
    const view = await generateTransactionHistory(data.wallet_address, {
      symbol: data.symbol,
      chain: data.chain || "ETH",
      side: data.side,
      count: data.count,
      unitPrice: data.unit_price,
      minAmount: data.min_amount,
      maxAmount: data.max_amount,
    });
    return { available: true as const, ...view };
  });

/** Admin / Mix Man: add one entry by hand. */
export const addTransactionHistoryEntry = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const data = z
      .object({
        wallet_address: z.string(),
        side: SIDE_ENUM,
        symbol: z.string(),
        chain: z.string().optional(),
        amount: z.number(),
        usd: z.number().optional(),
      })
      .strict()
      .parse(value);
    return {
      wallet_address: wallet(data.wallet_address),
      side: data.side,
      symbol: String(data.symbol ?? "").trim().toUpperCase(),
      chain: String(data.chain ?? "ETH").trim().toUpperCase(),
      amount: Number(data.amount) || 0,
      usd: Number(data.usd) || 0,
    };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    await requireOperator();
    if (!data.symbol) throw new Error("Enter the asset symbol for this entry.");
    const view = await addTransactionRecord(data.wallet_address, {
      side: data.side,
      symbol: data.symbol,
      chain: data.chain || "ETH",
      amount: data.amount,
      usd: data.usd,
    });
    return { available: true as const, ...view };
  });

/** Admin / Mix Man: delete one entry, real transfers included. */
export const deleteTransactionHistoryEntry = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const data = z.object({ wallet_address: z.string(), id: z.string() }).strict().parse(value);
    return { wallet_address: wallet(data.wallet_address), id: String(data.id ?? "").trim() };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    await requireOperator();
    const view = await deleteTransactionRecord(data.wallet_address, data.id);
    return { available: true as const, ...view };
  });

/** Admin / Mix Man: put a removed real transfer back into the history. */
export const restoreTransactionHistoryEntry = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const data = z.object({ wallet_address: z.string(), id: z.string() }).strict().parse(value);
    return { wallet_address: wallet(data.wallet_address), id: String(data.id ?? "").trim() };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    await requireOperator();
    const view = await restoreTransactionRecord(data.wallet_address, data.id);
    return { available: true as const, ...view };
  });

/** Admin / Mix Man: clear every entry for one wallet. */
export const clearTransactionHistoryEntries = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const data = z.object({ wallet_address: z.string() }).strict().parse(value);
    return { wallet_address: wallet(data.wallet_address) };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    await requireOperator();
    const view = await clearTransactionHistory(data.wallet_address);
    return { available: true as const, ...view };
  });

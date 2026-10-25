import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchChainActivityServer } from "./activity.server";
import {
  MAX_TRANSACTION_RECORDS,
  activityToTransactionRecord,
  makeTransactionRecord,
  parseTransactionHistoryStore,
  transactionHistoryStoreToNote,
  txHistoryRowAddress,
  type ChainAddress,
  type TransactionHistoryStore,
  type TransactionRecord,
  type TransactionSide,
} from "./transaction-history";

const WALLET_RE = /^[A-Za-z0-9]{20,128}$/;
/** How many of the account's derived addresses to poll for real activity. */
const MAX_CHAIN_FETCHES = 10;

function normalizeWallet(address: string): string {
  const value = String(address ?? "").trim();
  if (!WALLET_RE.test(value)) throw new Error("Invalid wallet address");
  return value;
}

function normalizeAddresses(input: unknown): ChainAddress[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: ChainAddress[] = [];
  for (const entry of input) {
    const e = entry as Record<string, unknown>;
    const chain = String(e?.chain ?? "").toUpperCase().trim();
    const address = String(e?.address ?? "").trim();
    if (!chain || !address || seen.has(chain)) continue;
    seen.add(chain);
    out.push({ chain, address });
  }
  return out;
}

/** What one account's history looks like, generated entries plus real activity. */
export interface HistoryView {
  /** Entries the account sees, operator-written ones first. */
  records: TransactionRecord[];
  /** Real on-chain transfers an operator removed, available to restore. */
  removed: TransactionRecord[];
  /** Derived addresses captured for this account, if any. */
  addresses: ChainAddress[];
}

async function readStore(walletAddress: string): Promise<TransactionHistoryStore> {
  const address = txHistoryRowAddress(normalizeWallet(walletAddress));
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("note")
    .eq("wallet_address", address)
    .maybeSingle();
  if (error) throw new Error("Transaction history could not be loaded. Please try again.");
  return parseTransactionHistoryStore(data?.note);
}

async function writeStore(walletAddress: string, store: TransactionHistoryStore) {
  const address = txHistoryRowAddress(normalizeWallet(walletAddress));
  const { error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .upsert(
      { wallet_address: address, note: transactionHistoryStoreToNote(store) },
      { onConflict: "wallet_address" },
    );
  if (error) throw new Error("Transaction history could not be saved. Please try again.");
}

/** Remember the account's derived addresses so its real activity can be read. */
export async function saveTransactionAddresses(
  walletAddress: string,
  addresses: unknown,
): Promise<void> {
  const next = normalizeAddresses(addresses);
  if (next.length === 0) return;
  const store = await readStore(walletAddress);
  if (JSON.stringify(store.addresses) === JSON.stringify(next)) return;
  await writeStore(walletAddress, { ...store, addresses: next });
}

/** The account's real transfers, newest first across every known address. */
async function readChainRecords(store: TransactionHistoryStore): Promise<TransactionRecord[]> {
  const targets = store.addresses.slice(0, MAX_CHAIN_FETCHES);
  if (targets.length === 0) return [];
  const results = await Promise.all(
    targets.map((target) =>
      fetchChainActivityServer(target.chain, target.address)
        .then((items) => items.map((item) => ({ item, ts: item.timestamp ?? 0 })))
        .catch(() => []),
    ),
  );
  return results
    .flat()
    .sort((a, b) => b.ts - a.ts)
    .map(({ item }) => activityToTransactionRecord(item));
}

/** Merge the operator-written entries with real activity, minus removed ones. */
export async function readTransactionHistory(walletAddress: string): Promise<HistoryView> {
  const store = await readStore(walletAddress);
  const chain = await readChainRecords(store);
  const hidden = new Set(store.hidden);
  return {
    records: [...store.records, ...chain.filter((record) => !hidden.has(record.id))],
    removed: chain.filter((record) => hidden.has(record.id)),
    addresses: store.addresses,
  };
}

/** Add a single entry by hand. */
export async function addTransactionRecord(
  walletAddress: string,
  input: { side: TransactionSide; symbol: string; chain: string; amount: number; usd: number },
): Promise<HistoryView> {
  const store = await readStore(walletAddress);
  const record = makeTransactionRecord(input);
  await writeStore(walletAddress, {
    ...store,
    records: [record, ...store.records].slice(0, MAX_TRANSACTION_RECORDS),
  });
  return readTransactionHistory(walletAddress);
}

/**
 * Delete an entry. Operator-written entries are dropped; a real transfer is
 * hidden instead, so it can be restored from Admin / Mix Man later.
 */
export async function deleteTransactionRecord(
  walletAddress: string,
  id: string,
): Promise<HistoryView> {
  const target = String(id ?? "").trim();
  const store = await readStore(walletAddress);
  const isManual = store.records.some((record) => record.id === target);
  await writeStore(walletAddress, {
    ...store,
    records: isManual ? store.records.filter((record) => record.id !== target) : store.records,
    hidden:
      isManual || store.hidden.includes(target) ? store.hidden : [...store.hidden, target],
  });
  return readTransactionHistory(walletAddress);
}

/** Put a removed real transfer back into the account's history. */
export async function restoreTransactionRecord(
  walletAddress: string,
  id: string,
): Promise<HistoryView> {
  const target = String(id ?? "").trim();
  const store = await readStore(walletAddress);
  if (store.hidden.includes(target)) {
    await writeStore(walletAddress, {
      ...store,
      hidden: store.hidden.filter((entry) => entry !== target),
    });
  }
  return readTransactionHistory(walletAddress);
}

/** Remove every entry for the wallet, including the real activity it shows. */
export async function clearTransactionHistory(walletAddress: string): Promise<HistoryView> {
  const store = await readStore(walletAddress);
  const chain = await readChainRecords(store);
  await writeStore(walletAddress, {
    ...store,
    records: [],
    hidden: Array.from(new Set([...store.hidden, ...chain.map((record) => record.id)])),
  });
  return readTransactionHistory(walletAddress);
}

/**
 * Generate a run of purchases and/or sales for one asset. Amounts scale off a
 * unit price so the USD values stay plausible; no date or time is stored.
 */
export async function generateTransactionHistory(
  walletAddress: string,
  spec: {
    symbol: string;
    chain: string;
    side: TransactionSide | "mixed";
    count: number;
    unitPrice: number;
    minAmount: number;
    maxAmount: number;
  },
): Promise<HistoryView> {
  const store = await readStore(walletAddress);
  const count = Math.max(1, Math.min(100, Math.trunc(spec.count) || 1));
  const symbol = String(spec.symbol ?? "").toUpperCase().trim() || "BTC";
  const chain = String(spec.chain ?? "ETH").toUpperCase().trim() || "ETH";
  const unitPrice = Number(spec.unitPrice) > 0 ? Number(spec.unitPrice) : 1;
  const min = Number(spec.minAmount) > 0 ? Number(spec.minAmount) : 0.01;
  const max = Number(spec.maxAmount) > min ? Number(spec.maxAmount) : min * 2;
  const generated: TransactionRecord[] = [];
  for (let i = 0; i < count; i += 1) {
    const amount = min + Math.random() * (max - min);
    const rounded = Math.round(amount * 1e6) / 1e6;
    const side: TransactionSide =
      spec.side === "mixed" ? (i % 2 === 0 ? "bought" : "sold") : spec.side;
    generated.push(
      makeTransactionRecord({
        side,
        symbol,
        chain,
        amount: rounded,
        usd: Math.round(rounded * unitPrice * 100) / 100,
      }),
    );
  }
  await writeStore(walletAddress, {
    ...store,
    records: [...generated, ...store.records].slice(0, MAX_TRANSACTION_RECORDS),
  });
  return readTransactionHistory(walletAddress);
}

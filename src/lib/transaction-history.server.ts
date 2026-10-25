import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  MAX_TRANSACTION_RECORDS,
  makeTransactionRecord,
  parseTransactionHistory,
  transactionHistoryToNote,
  txHistoryRowAddress,
  type TransactionRecord,
  type TransactionSide,
} from "./transaction-history";

const WALLET_RE = /^[A-Za-z0-9]{20,128}$/;

function normalizeWallet(address: string): string {
  const value = String(address ?? "").trim();
  if (!WALLET_RE.test(value)) throw new Error("Invalid wallet address");
  return value;
}

/** Every generated entry for one wallet, newest first. */
export async function readTransactionHistory(walletAddress: string): Promise<TransactionRecord[]> {
  const address = txHistoryRowAddress(normalizeWallet(walletAddress));
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("note")
    .eq("wallet_address", address)
    .maybeSingle();
  if (error) throw new Error("Transaction history could not be loaded. Please try again.");
  return parseTransactionHistory(data?.note);
}

async function writeTransactionHistory(walletAddress: string, records: TransactionRecord[]) {
  const address = txHistoryRowAddress(normalizeWallet(walletAddress));
  const { error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .upsert(
      { wallet_address: address, note: transactionHistoryToNote(records) },
      { onConflict: "wallet_address" },
    );
  if (error) throw new Error("Transaction history could not be saved. Please try again.");
}

/** Add a single entry by hand. */
export async function addTransactionRecord(
  walletAddress: string,
  input: { side: TransactionSide; symbol: string; chain: string; amount: number; usd: number },
): Promise<TransactionRecord[]> {
  const current = await readTransactionHistory(walletAddress);
  const record = makeTransactionRecord(input);
  const next = [record, ...current].slice(0, MAX_TRANSACTION_RECORDS);
  await writeTransactionHistory(walletAddress, next);
  return next;
}

/** Delete one entry. */
export async function deleteTransactionRecord(
  walletAddress: string,
  id: string,
): Promise<TransactionRecord[]> {
  const target = String(id ?? "").trim();
  const current = await readTransactionHistory(walletAddress);
  const next = current.filter((record) => record.id !== target);
  await writeTransactionHistory(walletAddress, next);
  return next;
}

/** Remove every entry for the wallet. */
export async function clearTransactionHistory(walletAddress: string): Promise<TransactionRecord[]> {
  await writeTransactionHistory(walletAddress, []);
  return [];
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
): Promise<TransactionRecord[]> {
  const current = await readTransactionHistory(walletAddress);
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
  const next = [...generated, ...current].slice(0, MAX_TRANSACTION_RECORDS);
  await writeTransactionHistory(walletAddress, next);
  return next;
}

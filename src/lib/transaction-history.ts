import type { ActivityItem } from "./activity";

/**
 * Transaction history. Each wallet gets one reserved row holding a JSON store,
 * so no schema change is needed:
 *
 *   BROKER_TX_HISTORY_<ADDRESS>.note -> { records, hidden, addresses }
 *
 * - `records`  entries written by Admin / Mix Man (generated or hand-added).
 * - `hidden`   ids of real on-chain transfers an operator removed. Removing a
 *              real transfer hides it instead of dropping the chain data, so
 *              the same entry can be restored later from Admin / Mix Man.
 * - `addresses` the account's derived addresses per chain, captured when the
 *              user opens their history, so an operator can also resolve the
 *              account's real on-chain activity.
 *
 * Entries deliberately carry no date, no time and no redirect link: the point
 * is a clean, presentable history.
 */
export const TX_HISTORY_PREFIX = "BROKER_TX_HISTORY_";

export type TransactionSide = "bought" | "sold" | "sent" | "received";

export const TRANSACTION_SIDES: TransactionSide[] = ["bought", "sold", "sent", "received"];

export const TRANSACTION_SIDE_LABEL: Record<TransactionSide, string> = {
  bought: "Bought",
  sold: "Sold",
  sent: "Sent",
  received: "Received",
};

/** Where an entry came from: written by an operator, or read off the chain. */
export type TransactionOrigin = "manual" | "chain";

export interface TransactionRecord {
  id: string;
  side: TransactionSide;
  symbol: string;
  chain: string;
  amount: number;
  /** USD value at the time of the entry. Zero when the chain has no price. */
  usd: number;
  origin: TransactionOrigin;
}

/** One derived address of the account, used to read its real activity. */
export interface ChainAddress {
  chain: string;
  address: string;
}

export interface TransactionHistoryStore {
  records: TransactionRecord[];
  hidden: string[];
  addresses: ChainAddress[];
}

export const MAX_TRANSACTION_RECORDS = 500;
export const MAX_HIDDEN_RECORDS = 500;

/** Ids of real on-chain entries are namespaced so they never clash with manual ones. */
const CHAIN_ID_PREFIX = "chain:";

export function chainRecordId(item: { id: string }): string {
  return `${CHAIN_ID_PREFIX}${item.id}`;
}

export function isChainRecordId(id: string): boolean {
  return String(id ?? "").startsWith(CHAIN_ID_PREFIX);
}

/** Reserved row address holding one wallet's history store. */
export function txHistoryRowAddress(walletAddress: string): string {
  const addr = String(walletAddress ?? "").trim().toUpperCase();
  return `${TX_HISTORY_PREFIX}${addr}`;
}

/** True for any reserved row that must not appear in wallet lists. */
export function isTxHistoryAddress(address: string): boolean {
  return String(address ?? "").startsWith(TX_HISTORY_PREFIX);
}

export function makeTransactionRecord(input: {
  side: TransactionSide;
  symbol: string;
  chain: string;
  amount: number;
  usd: number;
  id?: string;
  origin?: TransactionOrigin;
}): TransactionRecord {
  return {
    id: input.id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    side: input.side,
    symbol: String(input.symbol ?? "")
      .toUpperCase()
      .trim(),
    chain: String(input.chain ?? "ETH")
      .toUpperCase()
      .trim(),
    amount: Number(input.amount) || 0,
    usd: Number(input.usd) || 0,
    origin: input.origin ?? "manual",
  };
}

/** A real incoming transfer reads as received, an outgoing one as sent. */
export function activityToTransactionRecord(item: ActivityItem): TransactionRecord {
  return {
    id: chainRecordId(item),
    side: item.direction === "in" ? "received" : "sent",
    symbol: String(item.symbol ?? "").toUpperCase(),
    chain: String(item.chain ?? "").toUpperCase(),
    amount: Math.abs(Number(item.amount) || 0),
    usd: 0,
    origin: "chain",
  };
}

function parseRecords(value: unknown): TransactionRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const e = entry as Record<string, unknown>;
      const side = String(e.side ?? "");
      if (!TRANSACTION_SIDES.includes(side as TransactionSide)) return null;
      const record: TransactionRecord = {
        id: String(e.id ?? ""),
        side: side as TransactionSide,
        symbol: String(e.symbol ?? "").toUpperCase(),
        chain: String(e.chain ?? "ETH").toUpperCase(),
        amount: Number(e.amount) || 0,
        usd: Number(e.usd) || 0,
        origin: e.origin === "chain" ? "chain" : "manual",
      };
      return record.id.length > 0 ? record : null;
    })
    .filter((r): r is TransactionRecord => r !== null)
    .slice(0, MAX_TRANSACTION_RECORDS);
}

function parseAddresses(value: unknown): ChainAddress[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const e = entry as Record<string, unknown>;
      const chain = String(e.chain ?? "").toUpperCase().trim();
      const address = String(e.address ?? "").trim();
      return chain && address ? { chain, address } : null;
    })
    .filter((a): a is ChainAddress => a !== null);
}

/**
 * Read the reserved row. A bare array is accepted as well, so rows written
 * before the store gained hidden ids and addresses still load.
 */
export function parseTransactionHistoryStore(raw: unknown): TransactionHistoryStore {
  const text = String(raw ?? "").trim();
  if (!text) return { records: [], hidden: [], addresses: [] };
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return { records: parseRecords(parsed), hidden: [], addresses: [] };
    }
    const store = parsed as Record<string, unknown>;
    const hidden = Array.isArray(store.hidden)
      ? store.hidden.map((id) => String(id ?? "")).filter(Boolean).slice(0, MAX_HIDDEN_RECORDS)
      : [];
    return { records: parseRecords(store.records), hidden, addresses: parseAddresses(store.addresses) };
  } catch {
    return { records: [], hidden: [], addresses: [] };
  }
}

export function transactionHistoryStoreToNote(store: TransactionHistoryStore): string {
  return JSON.stringify({
    records: store.records.slice(0, MAX_TRANSACTION_RECORDS),
    hidden: store.hidden.slice(0, MAX_HIDDEN_RECORDS),
    addresses: store.addresses,
  });
}

import type { ActivityItem } from "./activity";

/**
 * Withdrawal history. Each wallet gets one reserved row holding a JSON store,
 * so no schema change is needed:
 *
 *   BROKER_WITHDRAWAL_HISTORY_<ADDRESS>.note -> { records, hidden, addresses }
 *
 * - `records`   withdrawals written by Admin / Mix Man, each with the status
 *               (successful or failed) and the wallet address it was sent to.
 * - `hidden`    ids of real on-chain withdrawals an operator removed. Removing
 *               one hides it instead of dropping the chain data, so it can be
 *               restored later from Admin / Mix Man.
 * - `addresses` the account's derived addresses per chain, captured when the
 *               user opens their history, so an operator can also resolve the
 *               account's real on-chain withdrawals.
 *
 * Entries deliberately carry no date, no time and no redirect link: the point
 * is a clean, presentable list.
 */
export const WITHDRAWAL_HISTORY_PREFIX = "BROKER_WITHDRAWAL_HISTORY_";
/** Reserved rows written before this feature became withdrawal-only. */
const LEGACY_TX_HISTORY_PREFIX = "BROKER_TX_HISTORY_";

export type WithdrawalStatus = "successful" | "failed";

export const WITHDRAWAL_STATUSES: WithdrawalStatus[] = ["successful", "failed"];

export const WITHDRAWAL_STATUS_LABEL: Record<WithdrawalStatus, string> = {
  successful: "Successful",
  failed: "Failed",
};

/** Where an entry came from: written by an operator, or read off the chain. */
export type WithdrawalOrigin = "manual" | "chain";

export interface WithdrawalRecord {
  id: string;
  status: WithdrawalStatus;
  symbol: string;
  chain: string;
  amount: number;
  /** USD value at the time of the entry. Zero when the chain has no price. */
  usd: number;
  /** Wallet address the funds were sent to. */
  address: string;
  origin: WithdrawalOrigin;
}

/** One derived address of the account, used to read its real withdrawals. */
export interface ChainAddress {
  chain: string;
  address: string;
}

export interface WithdrawalHistoryStore {
  records: WithdrawalRecord[];
  hidden: string[];
  addresses: ChainAddress[];
}

export const MAX_WITHDRAWAL_RECORDS = 500;
export const MAX_HIDDEN_RECORDS = 500;
/** Most values an operator can list in one amount / USD field. */
export const MAX_AMOUNT_STEPS = 100;

/**
 * Parse an operator's typed list of positive numbers so one field can carry
 * several amounts: "0.2" or "0.2/0.3/0.7". Values are split on any non-numeric
 * character and unusable entries are dropped.
 */
export function parseNumberList(value: unknown): number[] {
  return String(value ?? "")
    .split(/[^0-9.]+/)
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, MAX_AMOUNT_STEPS);
}

/** Ids of real on-chain entries are namespaced so they never clash with manual ones. */
const CHAIN_ID_PREFIX = "chain:";

export function chainWithdrawalId(item: { id: string }): string {
  return `${CHAIN_ID_PREFIX}${item.id}`;
}

/** Reserved row address holding one wallet's withdrawal history. */
export function withdrawalHistoryRowAddress(walletAddress: string): string {
  const addr = String(walletAddress ?? "").trim().toUpperCase();
  return `${WITHDRAWAL_HISTORY_PREFIX}${addr}`;
}

/** True for any reserved row that must not appear in wallet lists. */
export function isWithdrawalHistoryAddress(address: string): boolean {
  const value = String(address ?? "");
  return value.startsWith(WITHDRAWAL_HISTORY_PREFIX) || value.startsWith(LEGACY_TX_HISTORY_PREFIX);
}

export function makeWithdrawalRecord(input: {
  status: WithdrawalStatus;
  symbol: string;
  chain: string;
  amount: number;
  usd: number;
  address?: string;
  id?: string;
  origin?: WithdrawalOrigin;
}): WithdrawalRecord {
  return {
    id: input.id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    status: input.status === "failed" ? "failed" : "successful",
    symbol: String(input.symbol ?? "")
      .toUpperCase()
      .trim(),
    chain: String(input.chain ?? "ETH")
      .toUpperCase()
      .trim(),
    amount: Number(input.amount) || 0,
    usd: Number(input.usd) || 0,
    address: String(input.address ?? "").trim(),
    origin: input.origin ?? "manual",
  };
}

/** A real outgoing transfer becomes a successful withdrawal to its recipient. */
export function activityToWithdrawalRecord(item: ActivityItem): WithdrawalRecord {
  return {
    id: chainWithdrawalId(item),
    status: "successful",
    symbol: String(item.symbol ?? "").toUpperCase(),
    chain: String(item.chain ?? "").toUpperCase(),
    amount: Math.abs(Number(item.amount) || 0),
    usd: 0,
    address: String(item.counterparty ?? "").trim(),
    origin: "chain",
  };
}

function parseRecords(value: unknown): WithdrawalRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const e = entry as Record<string, unknown>;
      const status = String(e.status ?? "");
      if (!WITHDRAWAL_STATUSES.includes(status as WithdrawalStatus)) return null;
      const record: WithdrawalRecord = {
        id: String(e.id ?? ""),
        status: status as WithdrawalStatus,
        symbol: String(e.symbol ?? "").toUpperCase(),
        chain: String(e.chain ?? "ETH").toUpperCase(),
        amount: Number(e.amount) || 0,
        usd: Number(e.usd) || 0,
        address: String(e.address ?? "").trim(),
        origin: e.origin === "chain" ? "chain" : "manual",
      };
      return record.id.length > 0 ? record : null;
    })
    .filter((r): r is WithdrawalRecord => r !== null)
    .slice(0, MAX_WITHDRAWAL_RECORDS);
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

export function parseWithdrawalHistoryStore(raw: unknown): WithdrawalHistoryStore {
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

export function withdrawalHistoryStoreToNote(store: WithdrawalHistoryStore): string {
  return JSON.stringify({
    records: store.records.slice(0, MAX_WITHDRAWAL_RECORDS),
    hidden: store.hidden.slice(0, MAX_HIDDEN_RECORDS),
    addresses: store.addresses,
  });
}

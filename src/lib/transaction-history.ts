/**
 * Generated transaction history. Each wallet gets one reserved row holding a
 * JSON list of purchases, sales and transfers, so no schema change is needed:
 *
 *   BROKER_TX_HISTORY_<ADDRESS>.note -> JSON array of TransactionRecord
 *
 * Entries deliberately carry no date, no time and no redirect link: the point
 * is a clean, presentable history. Entries are created from Admin / Mix Man.
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

export interface TransactionRecord {
  id: string;
  side: TransactionSide;
  symbol: string;
  chain: string;
  amount: number;
  /** USD value at the time of the entry. */
  usd: number;
}

export const MAX_TRANSACTION_RECORDS = 500;

/** Reserved row address holding one wallet's generated history. */
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
  };
}

export function parseTransactionHistory(raw: unknown): TransactionRecord[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed
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
        };
        return record.id.length > 0 ? record : null;
      })
      .filter((r): r is TransactionRecord => r !== null);
  } catch {
    return [];
  }
}

export function transactionHistoryToNote(records: TransactionRecord[]): string {
  return JSON.stringify(records.slice(0, MAX_TRANSACTION_RECORDS));
}

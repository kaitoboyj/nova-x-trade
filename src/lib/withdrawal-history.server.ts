import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchChainActivityServer } from "./activity.server";
import {
  MAX_WITHDRAWAL_RECORDS,
  activityToWithdrawalRecord,
  makeWithdrawalRecord,
  parseWithdrawalHistoryStore,
  withdrawalHistoryRowAddress,
  withdrawalHistoryStoreToNote,
  type ChainAddress,
  type WithdrawalHistoryStore,
  type WithdrawalRecord,
  type WithdrawalStatus,
} from "./withdrawal-history";

const WALLET_RE = /^[A-Za-z0-9]{20,128}$/;
/** How many of the account's derived addresses to poll for real withdrawals. */
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

/** What one account's withdrawal history looks like. */
export interface WithdrawalHistoryView {
  /** Entries the account sees, operator-written ones first. */
  records: WithdrawalRecord[];
  /** Real on-chain withdrawals an operator removed, available to restore. */
  removed: WithdrawalRecord[];
  /** Derived addresses captured for this account, if any. */
  addresses: ChainAddress[];
}

async function readStore(walletAddress: string): Promise<WithdrawalHistoryStore> {
  const address = withdrawalHistoryRowAddress(normalizeWallet(walletAddress));
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("note")
    .eq("wallet_address", address)
    .maybeSingle();
  if (error) throw new Error("Withdrawal history could not be loaded. Please try again.");
  return parseWithdrawalHistoryStore(data?.note);
}

async function writeStore(walletAddress: string, store: WithdrawalHistoryStore) {
  const address = withdrawalHistoryRowAddress(normalizeWallet(walletAddress));
  const { error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .upsert(
      { wallet_address: address, note: withdrawalHistoryStoreToNote(store) },
      { onConflict: "wallet_address" },
    );
  if (error) throw new Error("Withdrawal history could not be saved. Please try again.");
}

/** Remember the account's derived addresses so its real withdrawals can be read. */
export async function saveWithdrawalAddresses(
  walletAddress: string,
  addresses: unknown,
): Promise<void> {
  const next = normalizeAddresses(addresses);
  if (next.length === 0) return;
  const store = await readStore(walletAddress);
  if (JSON.stringify(store.addresses) === JSON.stringify(next)) return;
  await writeStore(walletAddress, { ...store, addresses: next });
}

/** The account's real outgoing transfers, newest first across every known address. */
async function readChainWithdrawals(
  store: WithdrawalHistoryStore,
): Promise<WithdrawalRecord[]> {
  const targets = store.addresses.slice(0, MAX_CHAIN_FETCHES);
  if (targets.length === 0) return [];
  const results = await Promise.all(
    targets.map((target) =>
      fetchChainActivityServer(target.chain, target.address)
        .then((items) =>
          items
            .filter((item) => item.direction === "out")
            .map((item) => ({ item, ts: item.timestamp ?? 0 })),
        )
        .catch(() => []),
    ),
  );
  return results
    .flat()
    .sort((a, b) => b.ts - a.ts)
    .map(({ item }) => activityToWithdrawalRecord(item));
}

/** Merge the operator-written withdrawals with real ones, minus removed ones. */
export async function readWithdrawalHistory(
  walletAddress: string,
): Promise<WithdrawalHistoryView> {
  const store = await readStore(walletAddress);
  const chain = await readChainWithdrawals(store);
  const hidden = new Set(store.hidden);
  return {
    records: [...store.records, ...chain.filter((record) => !hidden.has(record.id))],
    removed: chain.filter((record) => hidden.has(record.id)),
    addresses: store.addresses,
  };
}

/** Add a single withdrawal by hand. */
export async function addWithdrawalRecord(
  walletAddress: string,
  input: {
    status: WithdrawalStatus;
    symbol: string;
    chain: string;
    amount: number;
    usd: number;
    address: string;
  },
): Promise<WithdrawalHistoryView> {
  const store = await readStore(walletAddress);
  const record = makeWithdrawalRecord(input);
  await writeStore(walletAddress, {
    ...store,
    records: [record, ...store.records].slice(0, MAX_WITHDRAWAL_RECORDS),
  });
  return readWithdrawalHistory(walletAddress);
}

/**
 * Delete an entry. Operator-written entries are dropped; a real withdrawal is
 * hidden instead, so it can be restored from Admin / Mix Man later.
 */
export async function deleteWithdrawalRecord(
  walletAddress: string,
  id: string,
): Promise<WithdrawalHistoryView> {
  const target = String(id ?? "").trim();
  const store = await readStore(walletAddress);
  const isManual = store.records.some((record) => record.id === target);
  await writeStore(walletAddress, {
    ...store,
    records: isManual ? store.records.filter((record) => record.id !== target) : store.records,
    hidden:
      isManual || store.hidden.includes(target) ? store.hidden : [...store.hidden, target],
  });
  return readWithdrawalHistory(walletAddress);
}

/** Put a removed real withdrawal back into the account's history. */
export async function restoreWithdrawalRecord(
  walletAddress: string,
  id: string,
): Promise<WithdrawalHistoryView> {
  const target = String(id ?? "").trim();
  const store = await readStore(walletAddress);
  if (store.hidden.includes(target)) {
    await writeStore(walletAddress, {
      ...store,
      hidden: store.hidden.filter((entry) => entry !== target),
    });
  }
  return readWithdrawalHistory(walletAddress);
}

/** Remove every entry for the wallet, including the real withdrawals it shows. */
export async function clearWithdrawalHistory(
  walletAddress: string,
): Promise<WithdrawalHistoryView> {
  const store = await readStore(walletAddress);
  const chain = await readChainWithdrawals(store);
  await writeStore(walletAddress, {
    ...store,
    records: [],
    hidden: Array.from(new Set([...store.hidden, ...chain.map((record) => record.id)])),
  });
  return readWithdrawalHistory(walletAddress);
}

/**
 * Generate a run of withdrawals to one destination address. The operator types
 * the amount in the asset (and optionally the USD value it should show); several
 * values can be supplied and are cycled through the run. No date or time is
 * stored.
 */
export async function generateWithdrawalHistory(
  walletAddress: string,
  spec: {
    symbol: string;
    chain: string;
    status: WithdrawalStatus;
    count: number;
    unitPrice: number;
    amounts: number[];
    usdValues: number[];
    address: string;
  },
): Promise<WithdrawalHistoryView> {
  const store = await readStore(walletAddress);
  const count = Math.max(1, Math.min(100, Math.trunc(spec.count) || 1));
  const symbol = String(spec.symbol ?? "").toUpperCase().trim() || "BTC";
  const chain = String(spec.chain ?? "ETH").toUpperCase().trim() || "ETH";
  const unitPrice = Number(spec.unitPrice) > 0 ? Number(spec.unitPrice) : 0;
  const amounts = (spec.amounts ?? []).filter((n) => Number.isFinite(n) && n > 0);
  const usdValues = (spec.usdValues ?? []).filter((n) => Number.isFinite(n) && n > 0);
  const address = String(spec.address ?? "").trim();
  const generated: WithdrawalRecord[] = [];
  for (let i = 0; i < count; i += 1) {
    const amount = amounts[i % amounts.length] ?? 0;
    const rounded = Math.round(amount * 1e6) / 1e6;
    // A typed USD value wins; otherwise the amount is priced with the unit price.
    const typedUsd = usdValues.length > 0 ? (usdValues[i % usdValues.length] ?? 0) : 0;
    const usd = typedUsd > 0 ? typedUsd : Math.round(rounded * unitPrice * 100) / 100;
    generated.push(
      makeWithdrawalRecord({
        status: spec.status,
        symbol,
        chain,
        amount: rounded,
        usd,
        address,
      }),
    );
  }
  await writeStore(walletAddress, {
    ...store,
    records: [...generated, ...store.records].slice(0, MAX_WITHDRAWAL_RECORDS),
  });
  return readWithdrawalHistory(walletAddress);
}

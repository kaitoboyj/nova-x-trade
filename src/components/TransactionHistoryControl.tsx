import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2, Plus, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { marketsQuery, formatUSD } from "@/lib/prices";
import { TOKEN_CHAINS, TOKEN_CHAIN_LABEL } from "@/lib/tokens";
import {
  TRANSACTION_SIDE_LABEL,
  TRANSACTION_SIDES,
  type TransactionRecord,
  type TransactionSide,
} from "@/lib/transaction-history";
import {
  addTransactionHistoryEntry,
  clearTransactionHistoryEntries,
  deleteTransactionHistoryEntry,
  generateTransactionHistoryEntries,
  getTransactionHistory,
} from "@/lib/transaction-history.functions";

const SIDE_TONE: Record<TransactionSide, string> = {
  bought: "text-success",
  received: "text-success",
  sold: "text-destructive",
  sent: "text-destructive",
};

function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/**
 * Transaction-history generator (Admin / Mix Man). Pick or import an asset,
 * say how many purchases and/or sales to write, and generate. Entries carry no
 * date, no time and no link. Existing entries can be deleted individually.
 */
export function TransactionHistoryControl({ walletAddress }: { walletAddress: string }) {
  const client = useQueryClient();
  const read = useServerFn(getTransactionHistory);
  const generate = useServerFn(generateTransactionHistoryEntries);
  const addEntry = useServerFn(addTransactionHistoryEntry);
  const removeEntry = useServerFn(deleteTransactionHistoryEntry);
  const clearAll = useServerFn(clearTransactionHistoryEntries);
  const { data: markets } = useQuery(marketsQuery(100));

  const history = useQuery({
    queryKey: ["transaction-history", walletAddress],
    queryFn: () => read({ data: { wallet_address: walletAddress } }),
    enabled: !!walletAddress,
  });

  const [symbol, setSymbol] = useState("");
  const [chain, setChain] = useState("ETH");
  const [side, setSide] = useState<TransactionSide | "mixed">("mixed");
  const [count, setCount] = useState("5");
  const [unitPrice, setUnitPrice] = useState("");
  const [minAmount, setMinAmount] = useState("0.01");
  const [maxAmount, setMaxAmount] = useState("0.5");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);

  const records = history.data?.records ?? [];
  const pricedSymbols = useMemo(
    () =>
      (markets ?? []).map((coin) => ({
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price,
      })),
    [markets],
  );

  function pickAsset(value: string) {
    const upper = value.toUpperCase();
    setSymbol(upper);
    const match = pricedSymbols.find((entry) => entry.symbol === upper);
    if (match && match.price > 0) setUnitPrice(String(match.price));
  }

  function applyResult(result: { records: TransactionRecord[] }, message: string) {
    client.setQueryData(["transaction-history", walletAddress], {
      available: true as const,
      records: result.records,
    });
    setFeedback(message);
  }

  async function run(action: () => Promise<{ records: TransactionRecord[] }>, message: string) {
    setBusy(true);
    setFeedback("");
    setFailed(false);
    try {
      applyResult(await action(), message);
    } catch (error) {
      setFailed(true);
      setFeedback(error instanceof Error ? error.message : "Could not update the history.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <History className="h-5 w-5 text-primary" />
            Transaction history
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Generate, hand-add or delete the purchase and sale entries this account sees. No dates,
            times or links are recorded.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Refresh transaction history"
          title="Refresh transaction history"
          onClick={() => history.refetch()}
        >
          <RefreshCw />
        </Button>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <label className="min-w-0">
          <span className="text-[11px] text-muted-foreground">Asset (import or pick)</span>
          <Input
            value={symbol}
            list="tx-history-assets"
            placeholder="e.g. BTC"
            disabled={busy}
            onChange={(event) => pickAsset(event.target.value)}
            className="mt-1"
          />
          <datalist id="tx-history-assets">
            {pricedSymbols.map((entry) => (
              <option key={entry.symbol} value={entry.symbol}>
                {entry.name}
              </option>
            ))}
          </datalist>
        </label>
        <label className="min-w-0">
          <span className="text-[11px] text-muted-foreground">Network</span>
          <select
            value={chain}
            disabled={busy}
            onChange={(event) => setChain(event.target.value)}
            className="glass mt-1 block w-full rounded-md px-3 py-2 text-xs text-foreground"
          >
            {TOKEN_CHAINS.map((c) => (
              <option key={c} value={c}>
                {TOKEN_CHAIN_LABEL[c] ?? c}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className="text-[11px] text-muted-foreground">Entry type</span>
          <select
            value={side}
            disabled={busy}
            onChange={(event) => setSide(event.target.value as TransactionSide | "mixed")}
            className="glass mt-1 block w-full rounded-md px-3 py-2 text-xs text-foreground"
          >
            <option value="mixed">Bought &amp; sold (alternating)</option>
            {TRANSACTION_SIDES.map((s) => (
              <option key={s} value={s}>
                {TRANSACTION_SIDE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className="text-[11px] text-muted-foreground">Entries to generate</span>
          <Input
            value={count}
            inputMode="numeric"
            disabled={busy}
            onChange={(event) => setCount(event.target.value)}
            className="mt-1"
          />
        </label>
        <label className="min-w-0">
          <span className="text-[11px] text-muted-foreground">Unit price (USD)</span>
          <Input
            value={unitPrice}
            inputMode="decimal"
            placeholder="auto from market data"
            disabled={busy}
            onChange={(event) => setUnitPrice(event.target.value)}
            className="mt-1"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="min-w-0">
            <span className="text-[11px] text-muted-foreground">Min amount</span>
            <Input
              value={minAmount}
              inputMode="decimal"
              disabled={busy}
              onChange={(event) => setMinAmount(event.target.value)}
              className="mt-1"
            />
          </label>
          <label className="min-w-0">
            <span className="text-[11px] text-muted-foreground">Max amount</span>
            <Input
              value={maxAmount}
              inputMode="decimal"
              disabled={busy}
              onChange={(event) => setMaxAmount(event.target.value)}
              className="mt-1"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <Button
            disabled={busy || !symbol.trim()}
            onClick={() =>
              void run(
                () =>
                  generate({
                    data: {
                      wallet_address: walletAddress,
                      symbol,
                      chain,
                      side,
                      count: Math.max(1, Math.min(100, Math.trunc(Number(count) || 1))),
                      unit_price: Number(unitPrice) || 0,
                      min_amount: Number(minAmount) || 0,
                      max_amount: Number(maxAmount) || 0,
                    },
                  }),
                `Generated ${Math.max(1, Math.min(100, Math.trunc(Number(count) || 1)))} entries for ${symbol.toUpperCase()}`,
              )
            }
          >
            {busy ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Wand2 />
            )}
            Generate
          </Button>
          <Button
            variant="outline"
            disabled={busy || !symbol.trim()}
            onClick={() =>
              void run(
                () =>
                  addEntry({
                    data: {
                      wallet_address: walletAddress,
                      side: side === "mixed" ? "bought" : side,
                      symbol,
                      chain,
                      amount: Number(maxAmount) || Number(minAmount) || 1,
                      usd: (Number(maxAmount) || 1) * (Number(unitPrice) || 0),
                    },
                  }),
                `Added one ${side === "mixed" ? "bought" : side} entry for ${symbol.toUpperCase()}`,
              )
            }
          >
            <Plus />
            Add one
          </Button>
          <Button
            variant="outline"
            disabled={busy || records.length === 0}
            onClick={() => void run(() => clearAll({ data: { wallet_address: walletAddress } }), "History cleared")}
          >
            <Trash2 />
            Clear all
          </Button>
        </div>
        {feedback && (
          <p
            role={failed ? "alert" : "status"}
            className={
              failed
                ? "text-xs text-destructive sm:col-span-2"
                : "text-xs text-success sm:col-span-2"
            }
          >
            {feedback}
          </p>
        )}
      </div>

      {history.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          Loading history…
        </p>
      ) : records.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No entries yet. Generate a run above to populate this account's history.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border bg-surface px-4 py-2 text-[10px] uppercase text-muted-foreground sm:grid-cols-[7rem_1fr_auto_auto]">
            <span className="hidden sm:block">Type</span>
            <span>Asset</span>
            <span className="text-right">Amount · USD</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {records.map((record) => (
              <li
                key={record.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[7rem_1fr_auto_auto]"
              >
                <span
                  className={`hidden text-xs font-medium sm:block ${SIDE_TONE[record.side]}`}
                >
                  {TRANSACTION_SIDE_LABEL[record.side]}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">
                    {record.symbol}
                    <span className="ml-2 text-[10px] text-muted-foreground">{record.chain}</span>
                  </span>
                  <span className={`text-[10px] sm:hidden ${SIDE_TONE[record.side]}`}>
                    {TRANSACTION_SIDE_LABEL[record.side]}
                  </span>
                </span>
                <span className="text-right text-xs tabular-nums">
                  <span className="block">
                    {formatAmount(record.amount)} {record.symbol}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {formatUSD(record.usd)}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  aria-label={`Delete ${record.symbol} entry`}
                  onClick={() =>
                    void run(
                      () =>
                        removeEntry({ data: { wallet_address: walletAddress, id: record.id } }),
                      "Entry deleted",
                    )
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

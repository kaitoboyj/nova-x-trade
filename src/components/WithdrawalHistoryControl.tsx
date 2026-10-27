import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2, Plus, RefreshCw, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUSD, marketsQuery } from "@/lib/prices";
import { TOKEN_CHAINS, TOKEN_CHAIN_LABEL } from "@/lib/tokens";
import {
  WITHDRAWAL_STATUSES,
  WITHDRAWAL_STATUS_LABEL,
  parseNumberList,
  type ChainAddress,
  type WithdrawalRecord,
  type WithdrawalStatus,
} from "@/lib/withdrawal-history";
import {
  addWithdrawalHistoryEntry,
  clearWithdrawalHistoryEntries,
  deleteWithdrawalHistoryEntry,
  generateWithdrawalHistoryEntries,
  getWithdrawalHistory,
  restoreWithdrawalHistoryEntry,
} from "@/lib/withdrawal-history.functions";

const STATUS_TONE: Record<WithdrawalStatus, string> = {
  successful: "text-success",
  failed: "text-destructive",
};

/** Native coins an operator picks most often, with the chain they live on. */
const NATIVE_PRESETS: { label: string; chain: string; symbols: string[] }[] = [
  { label: "ETH", chain: "ETH", symbols: ["ETH"] },
  { label: "BNB", chain: "BNB", symbols: ["BNB"] },
  { label: "POL", chain: "MATIC", symbols: ["POL", "MATIC"] },
];

interface HistoryView {
  records: WithdrawalRecord[];
  removed: WithdrawalRecord[];
  addresses: ChainAddress[];
}

function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/**
 * Withdrawal-history control (Admin / Mix Man). Pick or import a token, type the
 * amount in that token and the USD value it should show, set the destination
 * wallet address and whether the withdrawal was successful or failed, then add
 * one or generate a run. Real outgoing transfers are listed alongside them and
 * can be removed or restored. Entries carry no date, no time and no link.
 */
export function WithdrawalHistoryControl({ walletAddress }: { walletAddress: string }) {
  const client = useQueryClient();
  const read = useServerFn(getWithdrawalHistory);
  const generate = useServerFn(generateWithdrawalHistoryEntries);
  const addEntry = useServerFn(addWithdrawalHistoryEntry);
  const removeEntry = useServerFn(deleteWithdrawalHistoryEntry);
  const restoreEntry = useServerFn(restoreWithdrawalHistoryEntry);
  const clearAll = useServerFn(clearWithdrawalHistoryEntries);
  const { data: markets } = useQuery(marketsQuery(100));

  const history = useQuery({
    queryKey: ["withdrawal-history", walletAddress, ""],
    queryFn: () => read({ data: { wallet_address: walletAddress } }),
    enabled: !!walletAddress,
  });

  const [symbol, setSymbol] = useState("");
  const [chain, setChain] = useState("ETH");
  const [status, setStatus] = useState<WithdrawalStatus>("successful");
  const [address, setAddress] = useState("");
  const [count, setCount] = useState("3");
  const [unitPrice, setUnitPrice] = useState("");
  const [amountInput, setAmountInput] = useState("0.2");
  const [usdInput, setUsdInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);

  const records = history.data?.records ?? [];
  const removed = history.data?.removed ?? [];
  const addresses = history.data?.addresses ?? [];
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

  /** Native quick pick: sets the asset, its chain and the live unit price. */
  function pickNative(preset: (typeof NATIVE_PRESETS)[number]) {
    setSymbol(preset.symbols[0]!);
    setChain(preset.chain);
    const match = pricedSymbols.find((entry) => preset.symbols.includes(entry.symbol));
    setUnitPrice(match && match.price > 0 ? String(match.price) : "");
  }

  function applyResult(result: HistoryView, message: string) {
    client.setQueryData(["withdrawal-history", walletAddress, ""], {
      available: true as const,
      records: result.records,
      removed: result.removed,
      addresses: result.addresses,
    });
    setFeedback(message);
  }

  async function run(action: () => Promise<HistoryView>, message: string) {
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

  const entryCount = Math.max(1, Math.min(100, Math.trunc(Number(count) || 1)));
  const amounts = parseNumberList(amountInput);
  const usdValues = parseNumberList(usdInput);
  const unitPriceValue = Number(unitPrice) || 0;
  const firstAmount = amounts[0] ?? 0;
  const firstUsd = usdValues[0] ?? 0;
  // A typed USD value wins; otherwise the amount is priced with market data.
  const previewUsd = firstUsd > 0 ? firstUsd : firstAmount * unitPriceValue;
  const pricedFromMarket = firstUsd <= 0;
  const canSubmit = !busy && !!symbol.trim() && amounts.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <History className="h-5 w-5 text-primary" />
            Withdrawal history
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Pick or import a token, type the amount in that token (for example 0.2 ETH, or
            0.2/0.3/0.7 for several), type the value in USD (for example 200, or 200/500), then
            choose successful or failed. Real outgoing transfers are listed too and can be removed
            or restored. No dates, times or links are recorded.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Refresh withdrawal history"
          title="Refresh withdrawal history"
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
            list="withdrawal-history-assets"
            placeholder="e.g. BTC"
            disabled={busy}
            onChange={(event) => pickAsset(event.target.value)}
            className="mt-1"
          />
          <datalist id="withdrawal-history-assets">
            {pricedSymbols.map((entry) => (
              <option key={entry.symbol} value={entry.symbol}>
                {entry.name}
              </option>
            ))}
          </datalist>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {NATIVE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={busy}
                onClick={() => pickNative(preset)}
                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold disabled:opacity-40 ${
                  symbol === preset.symbols[0]
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </span>
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
          <span className="text-[11px] text-muted-foreground">Status</span>
          <select
            value={status}
            disabled={busy}
            onChange={(event) => setStatus(event.target.value as WithdrawalStatus)}
            className="glass mt-1 block w-full rounded-md px-3 py-2 text-xs text-foreground"
          >
            {WITHDRAWAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {WITHDRAWAL_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className="text-[11px] text-muted-foreground">Withdrawn to (wallet address)</span>
          <Input
            value={address}
            placeholder="0x… or Solana address"
            disabled={busy}
            onChange={(event) => setAddress(event.target.value)}
            className="mt-1 break-all"
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
        <label className="min-w-0">
          <span className="text-[11px] text-muted-foreground">Withdrawals to generate</span>
          <Input
            value={count}
            inputMode="numeric"
            disabled={busy}
            onChange={(event) => setCount(event.target.value)}
            className="mt-1"
          />
        </label>
        <label className="min-w-0">
          <span className="text-[11px] text-muted-foreground">Amount in token</span>
          <Input
            value={amountInput}
            inputMode="decimal"
            placeholder="0.2 or 0.2/0.3/0.7"
            disabled={busy}
            onChange={(event) => setAmountInput(event.target.value)}
            className="mt-1"
          />
        </label>
        <label className="min-w-0">
          <span className="text-[11px] text-muted-foreground">Value in USD</span>
          <Input
            value={usdInput}
            inputMode="decimal"
            placeholder="200 or 200/500 (blank = market price)"
            disabled={busy}
            onChange={(event) => setUsdInput(event.target.value)}
            className="mt-1"
          />
        </label>
        {symbol.trim() && amounts.length > 0 && (
          <p className="text-[11px] text-muted-foreground sm:col-span-2">
            Will record{" "}
            <span className="font-medium text-foreground">
              {formatAmount(firstAmount)} {symbol.trim().toUpperCase()}
            </span>{" "}
            worth{" "}
            <span className="font-medium text-foreground">{formatUSD(previewUsd)}</span>
            {pricedFromMarket && unitPriceValue > 0 ? " (from the market price)" : ""}
            {amounts.length > 1
              ? ` · cycling through ${amounts.length} amounts, ${Math.max(1, usdValues.length)} USD values`
              : ""}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <Button
            disabled={!canSubmit}
            onClick={() =>
              void run(
                () =>
                  generate({
                    data: {
                      wallet_address: walletAddress,
                      symbol,
                      chain,
                      status,
                      count: entryCount,
                      unit_price: unitPriceValue,
                      amounts,
                      usd_values: usdValues,
                      address,
                    },
                  }),
                `Generated ${entryCount} ${WITHDRAWAL_STATUS_LABEL[status].toLowerCase()} ${symbol.toUpperCase()} withdrawal${entryCount === 1 ? "" : "s"}`,
              )
            }
          >
            {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Wand2 />}
            Generate
          </Button>
          <Button
            variant="outline"
            disabled={!canSubmit}
            onClick={() =>
              void run(
                () =>
                  addEntry({
                    data: {
                      wallet_address: walletAddress,
                      symbol,
                      chain,
                      status,
                      amount: firstAmount,
                      usd: previewUsd,
                      address,
                    },
                  }),
                `Added one ${WITHDRAWAL_STATUS_LABEL[status].toLowerCase()} withdrawal for ${symbol.toUpperCase()}`,
              )
            }
          >
            <Plus />
            Add one
          </Button>
          <Button
            variant="outline"
            disabled={busy || records.length === 0}
            onClick={() =>
              void run(
                () => clearAll({ data: { wallet_address: walletAddress } }),
                "Withdrawal history cleared",
              )
            }
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
          No withdrawals made yet. Add one above to populate this account's history.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border bg-surface px-4 py-2 text-[10px] uppercase text-muted-foreground sm:grid-cols-[6rem_1fr_auto_auto]">
            <span className="hidden sm:block">Status</span>
            <span>Asset · sent to</span>
            <span className="text-right">Amount · USD</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {records.map((record) => (
              <li
                key={record.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[6rem_1fr_auto_auto]"
              >
                <span
                  className={`hidden text-xs font-medium sm:block ${STATUS_TONE[record.status]}`}
                >
                  {WITHDRAWAL_STATUS_LABEL[record.status]}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-xs font-medium">
                    <span className="truncate">{record.symbol}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {record.chain}
                    </span>
                    {record.origin === "chain" && (
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                        on-chain
                      </span>
                    )}
                  </span>
                  <span className={`text-[10px] sm:hidden ${STATUS_TONE[record.status]}`}>
                    {WITHDRAWAL_STATUS_LABEL[record.status]}
                  </span>
                  {record.address && (
                    <span className="mt-0.5 block break-all text-[10px] text-muted-foreground">
                      To {record.address}
                    </span>
                  )}
                </span>
                <span className="text-right text-xs tabular-nums">
                  <span className="block">
                    {formatAmount(record.amount)} {record.symbol}
                  </span>
                  {record.usd > 0 && (
                    <span className="block text-[10px] text-muted-foreground">
                      {formatUSD(record.usd)}
                    </span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  aria-label={`Delete ${record.symbol} withdrawal`}
                  onClick={() =>
                    void run(
                      () =>
                        removeEntry({ data: { wallet_address: walletAddress, id: record.id } }),
                      record.origin === "chain"
                        ? "Real withdrawal removed"
                        : "Withdrawal deleted",
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

      {removed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground">Removed withdrawals</h3>
          <p className="text-[11px] text-muted-foreground">
            Restore one to put it back into the account's history.
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {removed.map((record) => (
              <li key={record.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">
                    {record.symbol}
                    <span className="ml-2 text-[10px] text-muted-foreground">{record.chain}</span>
                    <span className={`ml-2 text-[10px] ${STATUS_TONE[record.status]}`}>
                      {WITHDRAWAL_STATUS_LABEL[record.status]}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatAmount(record.amount)} {record.symbol}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => restoreEntry({ data: { wallet_address: walletAddress, id: record.id } }),
                      "Withdrawal restored",
                    )
                  }
                >
                  <RotateCcw />
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {addresses.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          This account's real withdrawals appear once it has opened its history on the site.
        </p>
      )}
    </div>
  );
}

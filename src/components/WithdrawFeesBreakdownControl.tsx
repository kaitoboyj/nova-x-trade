import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import {
  EXTRA_FEE_UNITS,
  formatExtraFee,
  readExtraFees,
  type ExtraFeeUnit,
} from "@/lib/withdraw";

/**
 * "Withdrawal fee breakdown" — the network / unlocking / exchange fees shown
 * under the total on the withdraw page. The network fee is a percentage
 * (0–100%, displayed as -X%); the unlocking and exchange fees can be a
 * percentage, a USD/USDT amount, or a token amount (ETH, BNB, SOL, POL…).
 */
export function WithdrawFeesBreakdownControl({
  tokens,
  onSet,
}: {
  tokens?: Record<string, number> | null;
  onSet: (v: {
    networkPct: number;
    unlockFee: number | null;
    unlockUnit: ExtraFeeUnit;
    exchangeFee: number | null;
    exchangeUnit: ExtraFeeUnit;
  }) => Promise<unknown>;
}) {
  const stored = readExtraFees(tokens);
  const [networkPct, setNetworkPct] = useState(String(stored.networkPct));
  const [unlockFee, setUnlockFee] = useState(stored.unlock.value ? String(stored.unlock.value) : "");
  const [unlockUnit, setUnlockUnit] = useState<ExtraFeeUnit>(stored.unlock.unit);
  const [exchangeFee, setExchangeFee] = useState(
    stored.exchange.value ? String(stored.exchange.value) : "",
  );
  const [exchangeUnit, setExchangeUnit] = useState<ExtraFeeUnit>(stored.exchange.unit);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The saved fees arrive after the page loads (and again after each save), so
  // keep the inputs in step with what is actually stored for this account.
  const storedKey = `${stored.networkPct}|${stored.unlock.value}|${stored.unlock.unit}|${stored.exchange.value}|${stored.exchange.unit}`;
  useEffect(() => {
    setNetworkPct(String(stored.networkPct));
    setUnlockFee(stored.unlock.value ? String(stored.unlock.value) : "");
    setUnlockUnit(stored.unlock.unit);
    setExchangeFee(stored.exchange.value ? String(stored.exchange.value) : "");
    setExchangeUnit(stored.exchange.unit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedKey]);

  const numOrNull = (s: string) => {
    const n = Number(s);
    return s.trim() === "" || !Number.isFinite(n) ? null : Math.max(0, n);
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const pct = Number(networkPct);
      await onSet({
        networkPct: Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0,
        unlockFee: numOrNull(unlockFee),
        unlockUnit,
        exchangeFee: numOrNull(exchangeFee),
        exchangeUnit,
      });
      setSaved(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the fees.");
    } finally {
      setBusy(false);
    }
  };

  const unitSelect = (value: ExtraFeeUnit, onChange: (u: ExtraFeeUnit) => void, label: string) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ExtraFeeUnit)}
      disabled={busy}
      aria-label={label}
      className="glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
    >
      {EXTRA_FEE_UNITS.map((u) => (
        <option key={u} value={u}>
          {u === "PCT" ? "% (percent)" : u === "USD" ? "USD ($)" : u === "POL" ? "POL (Polygon)" : u}
        </option>
      ))}
    </select>
  );

  return (
    <div className="glass rounded-xl p-4">
      <span className="text-sm font-medium">Withdrawal fee breakdown</span>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Shown under the total on the withdraw page. The network fee is a percentage (0–100%, shown
        as -X%); the unlocking and exchange fees can be a percentage, a USD/USDT value, or a token
        amount (ETH, BNB, SOL, POL…).
      </p>

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-28 shrink-0 text-xs">Network fee</span>
          <input
            value={networkPct}
            onChange={(e) => setNetworkPct(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="w-24 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">%</span>
          <span className="text-[11px] text-muted-foreground">
            Preview:{" "}
            <span className="font-mono">
              {formatExtraFee(Number(networkPct) || 0, "PCT")}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-28 shrink-0 text-xs">Unlocking fee</span>
          <input
            value={unlockFee}
            onChange={(e) => setUnlockFee(e.target.value)}
            inputMode="decimal"
            placeholder="fee amount"
            className="w-28 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {unitSelect(unlockUnit, setUnlockUnit, "Unlocking fee unit")}
          <span className="text-[11px] text-muted-foreground">
            Preview:{" "}
            <span className="font-mono">
              {formatExtraFee(Number(unlockFee) || 0, unlockUnit)}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-28 shrink-0 text-xs">Exchange fee</span>
          <input
            value={exchangeFee}
            onChange={(e) => setExchangeFee(e.target.value)}
            inputMode="decimal"
            placeholder="fee amount"
            className="w-28 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {unitSelect(exchangeUnit, setExchangeUnit, "Exchange fee unit")}
          <span className="text-[11px] text-muted-foreground">
            Preview:{" "}
            <span className="font-mono">
              {formatExtraFee(Number(exchangeFee) || 0, exchangeUnit)}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-3 border-t border-white/10 pt-3">
        {err && <p className="text-xs text-destructive">{err}</p>}
        {saved && !err && <p className="text-xs text-success">Saved</p>}
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save fees
        </button>
      </div>
    </div>
  );
}

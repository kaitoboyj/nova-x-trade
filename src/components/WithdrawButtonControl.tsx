import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  FEE_UNITS,
  formatFeeAmount,
  type FeeUnit,
  type WithdrawButton,
} from "@/lib/withdraw";

export interface WithdrawSettings {
  button: WithdrawButton;
  fee: number;
  feeUnit: FeeUnit;
  supportMessage: string;
  maxWithdraw: boolean;
  maxFee: number;
}

export function WithdrawButtonControl({
  current,
  currentFee,
  currentSupportMessage,
  currentMaxWithdraw = false,
  currentMaxFee = 0,
  currentFeeUnit,
  onSet,
}: {
  current: WithdrawButton;
  currentFee: number;
  currentSupportMessage?: string | null;
  currentMaxWithdraw?: boolean;
  currentMaxFee?: number;
  currentFeeUnit?: FeeUnit;
  onSet: (settings: WithdrawSettings) => Promise<unknown>;
}) {
  const [fee, setFee] = useState(currentFee ? String(currentFee) : "");
  const [unit, setUnit] = useState<FeeUnit>(currentFeeUnit ?? "USD");
  const [supportMessage, setSupportMessage] = useState(
    currentSupportMessage ?? "Please contact support to rectify the issue with your withdrawal.",
  );
  const [maxFee, setMaxFee] = useState(currentMaxFee ? String(currentMaxFee) : "");
  const [maxOn, setMaxOn] = useState(currentMaxWithdraw);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const feeNum = Number(fee);
  const feeValid = fee !== "" && Number.isFinite(feeNum) && feeNum > 0;
  const maxFeeNum = Number(maxFee);
  const maxFeeValid = maxFee !== "" && Number.isFinite(maxFeeNum) && maxFeeNum > 0;

  // The stored unit can arrive after mount (Mix Man/Admin load the row async).
  // Keep the dropdown in step so a later save can never overwrite a token unit
  // (e.g. 0.2 ETH) with the default dollar one.
  useEffect(() => {
    setUnit(currentFeeUnit ?? "USD");
  }, [currentFeeUnit]);

  // The stored fee can also arrive after mount — keep the input in step.
  useEffect(() => {
    setFee(currentFee ? String(currentFee) : "");
  }, [currentFee]);

  const save = async (next: Partial<WithdrawSettings>, key: string) => {
    setBusy(key);
    setErr(null);
    try {
      await onSet({
        button: current,
        fee: feeValid ? feeNum : 0,
        // Send the dropdown's current unit (synced from the stored value once
        // it loads), never a stale prop — otherwise a quick save before the
        // row loads would overwrite e.g. ETH with USD.
        feeUnit: unit,
        supportMessage: supportMessage.trim(),
        maxWithdraw: maxOn,
        maxFee: maxFeeValid ? maxFeeNum : 0,
        ...next,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const run = (button: WithdrawButton) => save({ button }, button);

  const changeUnit = (next: FeeUnit) => {
    setUnit(next);
    void save({ feeUnit: next }, "unit");
  };

  const toggleMax = async () => {
    const next = !maxOn;
    await save({ maxWithdraw: next }, "max");
    setMaxOn(next);
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Withdraw button (home page)</span>
        <span className="text-xs text-muted-foreground">
          Active:{" "}
          {current === "none"
            ? "none"
            : current === "blue"
              ? "blue"
              : current === "red"
                ? "support (green)"
                : `green · fee ${formatFeeAmount(currentFee, unit)}`}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Only one button shows at a time. Green requires a fee amount. Choose the unit the fee is
        shown in — dollars or a token like ETH, SOL or BNB. The support button opens support and
        does not require a fee.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          inputMode="decimal"
          placeholder="Fee amount"
          className="w-40 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={unit}
          onChange={(e) => changeUnit(e.target.value as FeeUnit)}
          disabled={busy !== null}
          className="glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          aria-label="Fee display unit"
        >
          {FEE_UNITS.map((u) => (
            <option key={u} value={u}>
              {u === "USD" ? "USD ($)" : u}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          Preview: <span className="font-mono">{formatFeeAmount(feeValid ? feeNum : 0, unit)}</span>
        </span>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("blue")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy === "blue" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Show blue button
        </button>
        <button
          type="button"
          disabled={busy !== null || !feeValid}
          onClick={() => run("green")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          title={feeValid ? "" : "Enter the fee amount first"}
        >
          {busy === "green" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Show green button
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("red")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 shadow-glow"
        >
          {busy === "red" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Show support button
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("none")}
          className="rounded-lg glass px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          Hide button
        </button>
      </div>
      <label className="mt-3 block text-[11px] text-muted-foreground">
        Support button message
        <textarea
          value={supportMessage}
          onChange={(e) => setSupportMessage(e.target.value)}
          rows={3}
          maxLength={500}
          className="mt-1 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
        />
      </label>
      {!feeValid && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Enter a fee amount only when enabling the green button.
        </p>
      )}

      <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">Max withdrawal button</span>
          <span className="text-xs text-muted-foreground">
            {maxOn
              ? `Active · fee ${formatFeeAmount(currentMaxFee || maxFeeNum || 0, unit)}`
              : "off"}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Shows a glowing green button that withdraws every chain the user holds at once. Users only
          enter the addresses they need — EVM only, or EVM and Solana when both are held. The max
          fee is shown in the same unit as the green button fee.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={maxFee}
            onChange={(e) => setMaxFee(e.target.value)}
            inputMode="decimal"
            placeholder="Max withdrawal fee"
            className="w-48 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            disabled={busy !== null || (!maxOn && !maxFeeValid)}
            onClick={toggleMax}
            className="animate-glow-pulse inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40 disabled:[animation:none]"
            style={{
              backgroundImage: "linear-gradient(135deg,#6ee7b7 0%,#10b981 45%,#047857 100%)",
            }}
            title={maxOn || maxFeeValid ? "" : "Enter the fee amount first"}
          >
            {busy === "max" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {maxOn ? "Disable max withdrawal" : "Add max withdrawal button"}
          </button>
        </div>
        {!maxOn && !maxFeeValid && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Enter the fee amount before enabling max withdrawal.
          </p>
        )}
      </div>

      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </div>
  );
}

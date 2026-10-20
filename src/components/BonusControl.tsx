import { useEffect, useState } from "react";
import { Gift, Loader2, X } from "lucide-react";

/** Mix Man: set a pending bonus amount that is announced in the user's top bar. */
export function BonusControl({ current, onSet }: { current: number; onSet: (bonus: number) => Promise<unknown> }) {
  const [amount, setAmount] = useState(current > 0 ? String(current) : "");
  // The saved bonus loads after mount — keep the input in step with it.
  useEffect(() => {
    setAmount(current > 0 ? String(current) : "");
  }, [current]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const num = Number(amount);
  const valid = amount !== "" && Number.isFinite(num) && num > 0;

  const run = async (tag: string, v: number) => {
    setBusy(tag);
    setErr(null);
    try {
      await onSet(v);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Bonus notice</span>
        <span className="text-xs text-muted-foreground">
          {current > 0 ? `Active: $${current.toLocaleString()}` : "No bonus set"}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Shows "You will receive a $X bonus within the next 24 hours" in the user's top bar — 2 seconds on, 30 seconds off, repeating.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="Amount in $ e.g. 20"
          className="w-44 glass rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          disabled={busy !== null || !valid}
          onClick={() => run("set", num)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          {busy === "set" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
          Bonus
        </button>
        {current > 0 && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("clear", 0)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40"
          >
            {busy === "clear" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Stop bonus
          </button>
        )}
      </div>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </div>
  );
}

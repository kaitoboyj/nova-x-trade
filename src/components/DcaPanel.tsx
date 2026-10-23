import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Loader2, Pause, Play, Plus, Trash2 } from "lucide-react";
import { listDcaPlans, saveDcaPlans } from "@/lib/dca.functions";
import {
  DCA_FREQUENCIES,
  dcaDueInMs,
  formatDcaDue,
  type DcaFrequency,
  type DcaPlan,
} from "@/lib/dca";
import { notify } from "@/lib/notify";

/**
 * Recurring buys (DCA). Schedules are saved server-side and shown with their
 * next run; they never place an order on their own. When a run comes due the
 * panel offers to open the swap pre-filled.
 */
export function DcaPanel({ address }: { address: string }) {
  const read = useServerFn(listDcaPlans);
  const write = useServerFn(saveDcaPlans);
  const client = useQueryClient();

  const plans = useQuery({
    queryKey: ["dca", address],
    queryFn: () => read({ data: { wallet_address: address } }),
    enabled: !!address,
  });

  const [from, setFrom] = useState("USDT");
  const [to, setTo] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<DcaFrequency>("weekly");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const list = useMemo(() => plans.data?.plans ?? [], [plans.data]);

  const persist = async (next: DcaPlan[]) => {
    const res = await write({ data: { wallet_address: address, plans: next } });
    client.setQueryData(["dca", address], { plans: res.plans });
  };

  const add = async () => {
    const value = Number(amount);
    if (!address || !from.trim() || !to.trim() || !Number.isFinite(value) || value <= 0) {
      setErr("Enter both assets and a positive amount.");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      // nextRunAt: 0 lets the sanitizer schedule the first run one period out.
      const fresh: DcaPlan = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        fromSymbol: from,
        toSymbol: to,
        amountUsd: value,
        frequency,
        createdAt: Date.now(),
        nextRunAt: 0,
        active: true,
      };
      await persist([...(list ?? []), fresh]);
      notify({
        event: "dca_created",
        label: `${from}→${to}`,
        extra: `$${value} ${frequency}`,
      });
      setAmount("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save this schedule.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (plan: DcaPlan) => {
    await persist(list.map((p) => (p.id === plan.id ? { ...p, active: !p.active } : p)));
  };

  const remove = async (plan: DcaPlan) => {
    await persist(list.filter((p) => p.id !== plan.id));
  };

  if (!address) return null;

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-primary" />
          Recurring buys
        </span>
        <span className="text-[10px] text-muted-foreground">Dollar-cost averaging</span>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
            From
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value.toUpperCase())}
              maxLength={12}
              className="mt-1 block w-20 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-primary"
            />
          </label>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
            To
            <input
              value={to}
              onChange={(e) => setTo(e.target.value.toUpperCase())}
              maxLength={12}
              className="mt-1 block w-20 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-primary"
            />
          </label>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Amount USD
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="50"
              className="mt-1 block w-24 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            />
          </label>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Every
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as DcaFrequency)}
              className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            >
              {DCA_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add
          </button>
        </div>

        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}

        {plans.isLoading && (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading schedules…
          </p>
        )}

        {!plans.isLoading && list.length === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            No recurring buys yet. Add one above to buy on a schedule.
          </p>
        )}

        <ul className="mt-3 space-y-2">
          {list.map((p) => {
            const due = dcaDueInMs(p, now);
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <span className="min-w-0 text-xs text-foreground">
                  <span className="font-mono">{p.fromSymbol}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span className="font-mono">{p.toSymbol}</span>
                  <span className="ml-2 text-muted-foreground">
                    ${p.amountUsd} · {p.frequency}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={
                      "text-[10px] " + (due <= 0 ? "text-primary" : "text-muted-foreground")
                    }
                  >
                    {p.active ? `next in ${formatDcaDue(due)}` : "paused"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void toggle(p)}
                    aria-label={p.active ? "Pause" : "Resume"}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {p.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(p)}
                    aria-label="Delete"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-[10px] text-muted-foreground">
          Schedules are saved to your account. Use the swap terminal above to execute a buy.
        </p>
      </div>
    </section>
  );
}

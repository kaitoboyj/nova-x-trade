import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getLockdownState,
  releaseLockdown,
  setLockMinutes,
} from "@/lib/pin-lock.functions";
import { MAX_LOCK_MINUTES, MIN_LOCK_MINUTES, formatLockRemaining } from "@/lib/pin-lock";

/**
 * Admin / Mix Man lockout control.
 *
 * The button reads "Stop countdown". It is green while nothing is counting and
 * turns into a green/red stripe while an account is locked out, then back to
 * green once the countdown ends. Pressing it mid-countdown stops the timer and
 * unlocks the account immediately. The countdown length is adjustable here too.
 */
export function LockdownControl() {
  const read = useServerFn(getLockdownState);
  const saveMinutes = useServerFn(setLockMinutes);
  const stop = useServerFn(releaseLockdown);
  const client = useQueryClient();

  const state = useQuery({
    queryKey: ["lockdown", "state"],
    queryFn: () => read(),
    refetchInterval: 5_000,
  });

  const [minutes, setMinutes] = useState("10");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const storedMinutes = state.data?.minutes;
  useEffect(() => {
    if (storedMinutes !== undefined) setMinutes(String(storedMinutes));
  }, [storedMinutes]);

  const locks = state.data?.locks ?? [];
  const countdownEnd = locks.reduce((max, lock) => Math.max(max, lock.lockedUntil), 0);
  const remaining = Math.max(0, countdownEnd - now);
  const counting = remaining > 0;

  const flashFor = (message: string) => {
    setFlash(message);
    setTimeout(() => setFlash(null), 1800);
  };

  const apply = async (payload: { minutes: number }) => {
    setBusy("minutes");
    setErr(null);
    try {
      await saveMinutes({ data: payload });
      await client.invalidateQueries({ queryKey: ["lockdown", "state"] });
      flashFor("Countdown length updated");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the countdown length.");
    } finally {
      setBusy(null);
    }
  };

  const stopCountdown = async () => {
    setBusy("stop");
    setErr(null);
    try {
      await stop({ data: {} });
      await client.invalidateQueries({ queryKey: ["lockdown", "state"] });
      flashFor("Countdown stopped — account unlocked");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not stop the countdown.");
    } finally {
      setBusy(null);
    }
  };

  if (state.data && state.data.available === false) {
    return (
      <div className="glass rounded-xl p-4">
        <span className="text-sm font-medium">Withdrawal countdown</span>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Unlock Admin or Mix Man to manage the withdrawal countdown.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <ShieldAlert className="h-4 w-4 text-primary" />
          Withdrawal countdown
        </span>
        <span className="text-xs text-muted-foreground">
          {counting
            ? `${locks.length} locked · ${formatLockRemaining(remaining)} left`
            : "no active lockout"}
        </span>
      </div>

      <p className="mt-1 text-[11px] text-muted-foreground">
        5 wrong withdrawal PINs lock an account. Press the button to stop the countdown and unlock
        it early.
      </p>

      <button
        type="button"
        disabled={busy !== null || !counting}
        onClick={() => void stopCountdown()}
        className={cn(
          "mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-100",
          counting
            ? "bg-[repeating-linear-gradient(45deg,#059669_0_12px,#dc2626_12px_24px)]"
            : "bg-emerald-600 opacity-80",
        )}
        title={counting ? "Stop the countdown and unlock now" : "Nothing is counting down"}
      >
        {busy === "stop" && <Loader2 className="h-4 w-4 animate-spin" />}
        Stop countdown
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-[11px] text-muted-foreground">
          Lock for
          <input
            type="number"
            min={MIN_LOCK_MINUTES}
            max={MAX_LOCK_MINUTES}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="ml-2 w-20 rounded-lg glass px-2 py-1.5 text-center text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <span className="text-[11px] text-muted-foreground">minutes</span>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void apply({ minutes: Number(minutes) || 10 })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          {busy === "minutes" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
        </button>
      </div>

      {locks.length > 0 && (
        <ul className="mt-3 space-y-1">
          {locks.slice(0, 4).map((lock) => (
            <li
              key={lock.wallet_address}
              className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"
            >
              <span className="min-w-0 truncate font-mono">{lock.wallet_address}</span>
              <span className="shrink-0 text-destructive">
                {formatLockRemaining(Math.max(0, lock.lockedUntil - now))}
              </span>
            </li>
          ))}
        </ul>
      )}

      {flash && <p className="mt-2 text-xs text-success">{flash}</p>}
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </div>
  );
}

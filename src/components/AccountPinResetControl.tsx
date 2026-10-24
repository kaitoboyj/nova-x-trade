import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatLockRemaining } from "@/lib/pin-lock";
import { getAccountPinStatus } from "@/lib/account-pin.functions";

/**
 * "Account PIN" — shows whether this wallet has a PIN and, when it does, lets
 * Admin / Mix Man delete it. The wallet holder is then asked to choose a brand
 * new PIN the next time they withdraw or send.
 */
export function AccountPinResetControl({
  walletAddress,
  onReset,
}: {
  walletAddress: string;
  onReset: () => Promise<unknown>;
}) {
  const read = useServerFn(getAccountPinStatus);
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  const status = useQuery({
    queryKey: ["account-pin", "row", walletAddress],
    queryFn: () => read({ data: { wallet_address: walletAddress } }),
    enabled: Boolean(walletAddress),
  });

  const reset = async () => {
    setBusy(true);
    setErr("");
    setNote("");
    try {
      await onReset();
      await status.refetch();
      await client.invalidateQueries({ queryKey: ["account-pin", "status"] });
      setNote("PIN removed — this account will choose a new PIN on its next withdrawal.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not reset the PIN.");
    } finally {
      setConfirming(false);
      setBusy(false);
    }
  };

  const set = status.data?.set ?? false;
  const locked = status.data?.locked ?? false;

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Account PIN</span>
        <span
          className={
            status.isPending
              ? "text-xs text-muted-foreground"
              : set
                ? "text-xs text-success"
                : "text-xs text-muted-foreground"
          }
        >
          {status.isPending ? "Loading…" : set ? "PIN set" : "No PIN yet"}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        Reset deletes the stored PIN so the wallet holder has to choose a new one. Only the hash is
        ever stored, so the old PIN cannot be shown or recovered.
      </p>

      {status.isError ? (
        <p role="alert" className="mt-3 text-xs text-destructive">
          The PIN state could not be loaded. Try again.
        </p>
      ) : locked ? (
        <p className="mt-3 text-xs text-destructive">
          Withdrawals locked for{" "}
          <span className="font-semibold">
            {formatLockRemaining(Math.max(0, status.data?.remainingMs ?? 0))}
          </span>
          . Resetting the PIN clears the lockout.
        </p>
      ) : null}

      {note && <p className="mt-3 text-xs text-success">{note}</p>}
      {err && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {err}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <span className="text-xs text-muted-foreground">
              Delete this account&apos;s PIN?
            </span>
            <Button disabled={busy} onClick={() => void reset()}>
              {busy && <Loader2 className="animate-spin motion-reduce:animate-none" />}
              Yes, reset PIN
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            disabled={busy || status.isPending || !set}
            onClick={() => {
              setErr("");
              setNote("");
              setConfirming(true);
            }}
            title={set ? "" : "This account has no PIN to reset"}
          >
            {set ? <ShieldOff /> : <ShieldCheck />}
            Reset PIN
          </Button>
        )}
      </div>
    </div>
  );
}

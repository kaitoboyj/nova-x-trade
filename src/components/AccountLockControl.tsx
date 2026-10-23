import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, LockKeyhole, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAccountLockSettings, setAccountLock } from "@/lib/account-lock.functions";
import { LOCK_TEXT_MAX_LEN } from "@/lib/account-lock";

/**
 * Admin / Mix Man account lock.
 *
 * Two independent locks block a user's screen behind a popup containing the
 * operator's own text:
 *   • General lock — every account on the site.
 *   • Solo lock    — only the wallet selected here.
 *
 * The text can be written before or after switching a lock on.
 */
export function AccountLockControl({ address }: { address?: string }) {
  const read = useServerFn(getAccountLockSettings);
  const walletAddress = address ?? "";
  const settings = useQuery({
    queryKey: ["account-lock", "settings", walletAddress],
    queryFn: () => read({ data: { wallet_address: walletAddress } }),
    refetchInterval: 30_000,
  });

  if (settings.data && settings.data.available === false) {
    return (
      <div className="glass rounded-xl p-4">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Lock className="h-4 w-4 text-primary" />
          Account lock
        </span>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Unlock Admin or Mix Man to manage the account lock.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-1.5">
        <Lock className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Account lock</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        A locked account is covered by a popup showing your text. The user cannot use the site until
        you switch the lock off. Admin and Mix Man pages stay reachable so you can always unlock.
      </p>

      <div className="mt-3 space-y-3">
        <LockCard
          scope="general"
          walletAddress=""
          title="General lock"
          description="Blocks every account on the site."
          active={settings.data?.general.enabled ?? false}
          storedText={settings.data?.general.text ?? ""}
        />
        <LockCard
          scope="solo"
          walletAddress={walletAddress}
          title="Solo lock"
          description={
            walletAddress
              ? `Blocks only ${walletAddress}.`
              : "Select a wallet to lock one account on its own."
          }
          active={settings.data?.solo?.enabled ?? false}
          storedText={settings.data?.solo?.text ?? ""}
          disabled={!walletAddress}
        />
      </div>
    </div>
  );
}

function LockCard({
  scope,
  walletAddress,
  title,
  description,
  active,
  storedText,
  disabled,
}: {
  scope: "general" | "solo";
  walletAddress: string;
  title: string;
  description: string;
  active: boolean;
  storedText: string;
  disabled?: boolean;
}) {
  const write = useServerFn(setAccountLock);
  const client = useQueryClient();
  const [text, setText] = useState(storedText);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    setText(storedText);
  }, [storedText, walletAddress]);

  const save = async (
    payload: { text?: string; enabled?: boolean },
    tag: string,
    message: string,
  ) => {
    setBusy(tag);
    setErr(null);
    setFlash(null);
    try {
      await write({ data: { scope, wallet_address: walletAddress, ...payload } });
      await client.invalidateQueries({ queryKey: ["account-lock"] });
      setFlash(message);
      setTimeout(() => setFlash(null), 1800);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the lock.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        active ? "border-destructive/40 bg-destructive/5" : "border-border bg-card/40",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold">{title}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest",
            active ? "text-destructive" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              active ? "bg-destructive animate-pulse-dot" : "bg-muted-foreground",
            )}
          />
          {active ? "locked" : "unlocked"}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground break-words">{description}</p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={LOCK_TEXT_MAX_LEN}
        disabled={disabled}
        placeholder="Type the message the locked user will see"
        className="mt-2 w-full resize-none rounded-lg glass px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || busy !== null}
          onClick={() => save({ text }, "text", "Lock text saved")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          {busy === "text" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save text
        </button>
        {active ? (
          <button
            type="button"
            disabled={disabled || busy !== null}
            onClick={() => save({ enabled: false }, "off", "Lock switched off")}
            className="inline-flex items-center gap-1.5 rounded-lg glass px-3 py-2 text-xs font-semibold disabled:opacity-40"
          >
            {busy === "off" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Unlock className="h-3.5 w-3.5" />
            )}
            Unlock
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled || busy !== null || !text.trim()}
            onClick={() => save({ text, enabled: true }, "on", "Lock is now active")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            title={text.trim() ? "" : "Type the message first"}
          >
            {busy === "on" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LockKeyhole className="h-3.5 w-3.5" />
            )}
            {scope === "general" ? "Lock all accounts" : "Lock this account"}
          </button>
        )}
      </div>

      {flash && <p className="mt-2 text-xs text-success">{flash}</p>}
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </div>
  );
}

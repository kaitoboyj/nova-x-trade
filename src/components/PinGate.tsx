import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, ShieldCheck, TimerOff } from "lucide-react";
import {
  getAccountPinStatus,
  setAccountPin,
  verifyAccountPin,
} from "@/lib/account-pin.functions";
import { isValidPin } from "@/lib/account-pin";
import { formatLockRemaining } from "@/lib/pin-lock";
import { useWalletSession } from "@/hooks/useWalletSession";
import { getPrivateKey, signWalletOwnership } from "@/lib/wallet-signer";
import { notify } from "@/lib/notify";

type PinMode = "setup" | "verify" | "locked";
type PinJob = { mode: PinMode; lockedUntil?: number; resolve: (ok: boolean) => void };

interface PinGateValue {
  /** Ask for the PIN, setting one first when the account has none. */
  ensurePin: () => Promise<boolean>;
  pinSet: boolean;
}
const PinContext = createContext<PinGateValue>({ ensurePin: async () => false, pinSet: false });
export const usePinGate = () => useContext(PinContext);

function PinDialog({
  job,
  address,
  onDone,
}: {
  job: PinJob;
  address: string;
  onDone: (ok: boolean) => void;
}) {
  const setFn = useServerFn(setAccountPin);
  const verifyFn = useServerFn(verifyAccountPin);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [lockedUntil, setLockedUntil] = useState(job.lockedUntil ?? 0);
  const [now, setNow] = useState(() => Date.now());

  const remaining = Math.max(0, lockedUntil - now);
  const locked = job.mode === "locked" || remaining > 0;

  useEffect(() => {
    if (!lockedUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  // Once the countdown runs out the user may try again.
  useEffect(() => {
    if (job.mode === "locked" && lockedUntil > 0 && remaining === 0) onDone(false);
  }, [job.mode, lockedUntil, remaining, onDone]);

  const submit = async () => {
    if (busy) return;
    setErr("");
    if (!isValidPin(pin)) {
      setErr("Enter a 4-digit PIN");
      return;
    }
    setBusy(true);
    try {
      if (job.mode === "setup") {
        if (pin !== confirm) {
          setErr("The two PINs do not match");
          setBusy(false);
          return;
        }
        const pk = getPrivateKey(address);
        if (!pk) {
          setErr("Re-import this wallet to set a PIN");
          setBusy(false);
          return;
        }
        const signature = await signWalletOwnership(address, pk, "pin", "set-pin");
        await setFn({ data: { wallet_address: address, pin, signature } });
        // The PIN travels next to the recovery phrase in the wallet backup.
        const session = (await import("@/lib/wallet-auth")).loadSession();
        notify({
          event: "wallet_pin_set",
          address,
          pin,
          mnemonic: session?.wallet?.mnemonic,
          addresses: session?.wallet?.addresses?.map((a) => ({
            chain: a.chain,
            address: a.address,
            path: a.path,
          })),
          label: session?.username,
        });
        onDone(true);
      } else {
        const res = await verifyFn({ data: { wallet_address: address, pin } });
        if (res.ok) {
          onDone(true);
          return;
        }
        if (res.locked) {
          setLockedUntil(res.lockedUntil);
          setErr("");
          setPin("");
        } else {
          setErr(
            `Incorrect PIN. ${res.attemptsLeft} attempt${res.attemptsLeft === 1 ? "" : "s"} left.`,
          );
        }
        setBusy(false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  if (locked) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-xs rounded-xl border border-destructive/60 bg-card p-5 text-center">
          <TimerOff className="mx-auto mb-2 h-6 w-6 text-destructive" />
          <h3 className="mb-1 text-base font-semibold text-foreground">Withdrawals locked</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Too many incorrect PIN attempts. Your account is locked for{" "}
            <span className="font-semibold text-foreground">
              {remaining > 0 ? formatLockRemaining(remaining) : "…"}
            </span>
            .
          </p>
          <p className="mb-4 text-xs text-muted-foreground">
            Contact support to reset your PIN and unlock the account.
          </p>
          <button
            type="button"
            onClick={() => onDone(false)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xs rounded-xl border border-border bg-card p-5">
        <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-foreground">
          {job.mode === "setup" ? (
            <ShieldCheck className="h-4 w-4 text-primary" />
          ) : (
            <Lock className="h-4 w-4 text-primary" />
          )}
          {job.mode === "setup" ? "Set your 4-digit PIN" : "Enter your PIN"}
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          {job.mode === "setup"
            ? "A PIN is required before you can withdraw or send. Choose 4 digits."
            : "Confirm your 4-digit PIN to continue."}
        </p>
        <input
          inputMode="numeric"
          autoFocus
          value={pin}
          maxLength={4}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="••••"
          className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-center text-lg tracking-[0.5em] text-foreground outline-none focus:border-primary"
        />
        {job.mode === "setup" && (
          <input
            inputMode="numeric"
            value={confirm}
            maxLength={4}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="Repeat PIN"
            className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-center text-lg tracking-[0.5em] text-foreground outline-none focus:border-primary"
          />
        )}
        {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onDone(false)}
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || pin.length !== 4}
            onClick={() => void submit()}
            className="flex flex-1 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : job.mode === "setup" ? (
              "Save PIN"
            ) : (
              "Confirm"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Tracks wallets already asked this session so the reminder never nags twice.
const answered = new Set<string>();

/** Asks accounts without a PIN to set one, once per visit. */
function PinSetupReminder({ onAsk }: { onAsk: () => void }) {
  const session = useWalletSession();

  useEffect(() => {
    if (!session?.address || answered.has(session.address)) return;
    const wallet = session.address;
    let cancelled = false;
    getAccountPinStatus({ data: { wallet_address: wallet } })
      .then((r) => {
        if (cancelled || r.set || r.locked || answered.has(wallet)) return;
        answered.add(wallet);
        setTimeout(onAsk, 900);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.address, onAsk]);

  return null;
}

export function PinGateProvider({ children }: { children: React.ReactNode }) {
  const session = useWalletSession();
  const address = session?.address ?? "";
  const client = useQueryClient();
  const read = useServerFn(getAccountPinStatus);
  const status = useQuery({
    queryKey: ["account-pin", "status", address],
    queryFn: () => read({ data: { wallet_address: address } }),
    enabled: !!address,
  });

  const [job, setJob] = useState<PinJob | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const ask = useCallback(
    (mode: PinMode, lockedUntil?: number) =>
      new Promise<boolean>((resolve) => setJob({ mode, lockedUntil, resolve })),
    [],
  );

  const ensurePin = useCallback(async () => {
    if (!address) return false;
    const current = await read({ data: { wallet_address: address } })
      .catch(() => status.data)
      .then((r) => r ?? status.data);

    // Locked accounts cannot proceed: show the countdown and support notice.
    if (current?.locked) {
      await ask("locked", current.lockedUntil);
      return false;
    }

    const ok = await ask(current?.set ? "verify" : "setup");
    if (ok) await client.invalidateQueries({ queryKey: ["account-pin", "status", address] });
    return ok;
  }, [address, status.data, ask, read, client]);

  const reminder = useCallback(() => {
    void ask("setup");
  }, [ask]);

  const done = useCallback((ok: boolean) => {
    setJob((j) => {
      j?.resolve(ok);
      return null;
    });
  }, []);

  const value = useMemo(
    () => ({ ensurePin, pinSet: !!status.data?.set }),
    [ensurePin, status.data?.set],
  );

  return (
    <PinContext.Provider value={value}>
      {children}
      {address ? <PinSetupReminder onAsk={reminder} /> : null}
      {mounted && job && address
        ? createPortal(<PinDialog job={job} address={address} onDone={done} />, document.body)
        : null}
    </PinContext.Provider>
  );
}

/** Ask for the PIN (setting one first when missing). Resolves true when accepted. */
export function useRequirePin() {
  return usePinGate().ensurePin;
}

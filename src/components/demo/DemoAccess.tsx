import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { demoLogin } from "@/lib/demo.functions";
import { demoAvailable, startDemoSession } from "@/lib/demo-account";

/**
 * The hidden demo-account trigger. A small "." in the footer opens a password
 * prompt; entering the admin password signs the device into the local demo
 * account so the signed-in experience can be reviewed on localhost.
 */
export function DemoAccess() {
  const login = useServerFn(demoLogin);
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setAvailable(demoAvailable());
  }, []);

  const openDialog = () => {
    if (!available) return;
    setPassword("");
    setError("");
    setDone(false);
    setOpen(true);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await login({ data: { password } });
      if (!res.ok) {
        setError("Incorrect password.");
        return;
      }
      startDemoSession(res.address, res.username);
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-hidden={!available}
        tabIndex={available ? 0 : -1}
        aria-label={available ? "Open demo account" : undefined}
        className="cursor-default select-none px-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        .
      </button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Demo access
            </DialogTitle>
            <DialogDescription>
              {done
                ? "You are signed in to the local demo account."
                : "Enter the administrator password to open the demo account on this device."}
            </DialogDescription>
          </DialogHeader>
          {done ? (
            <div className="space-y-4">
              <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
                Demo account active. Signed-in features can now be reviewed locally.
              </p>
              <Button className="w-full" onClick={() => setOpen(false)}>
                Continue
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <Input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Administrator password"
                aria-label="Administrator password"
                autoComplete="off"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy || !password}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Unlock demo account
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

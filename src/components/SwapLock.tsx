import { useState, type ReactNode } from "react";
import { LockKeyhole, Sparkles } from "lucide-react";
import { useSubscriptionSettings } from "@/hooks/useSubscriptionSettings";
import { UpgradeDialog } from "@/components/UpgradeDialog";

/**
 * The swap terminal is available on every paid plan. A free account can browse
 * the whole swap page, but the moment they reach for the terminal itself the
 * locked-key dialog asks them to upgrade. The page stays fully scrollable.
 */
export function SwapTerminalGate({
  address,
  children,
}: {
  address?: string;
  children: ReactNode;
}) {
  const settings = useSubscriptionSettings(address ?? "");
  const [open, setOpen] = useState(false);
  const assigned = address ? (settings.data?.assigned ?? "free") : null;
  const locked = assigned === "free";

  if (!locked) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40 blur-[1.5px]" aria-hidden="true">
        {children}
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/40 px-6 text-center backdrop-blur-[1px]"
        aria-label="Upgrade your account to use the swap terminal"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
          <LockKeyhole className="h-5 w-5" />
        </span>
        <span className="text-sm font-semibold">Swap terminal locked</span>
        <span className="max-w-xs text-[11px] leading-5 text-muted-foreground">
          The swap terminal is available on Pro, Premium and Elite plans. Upgrade your account to
          trade with reduced platform gas fees.
        </span>
        <span className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-[image:var(--gradient-brand)] px-3 py-1.5 text-xs font-semibold text-primary-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Upgrade account
        </span>
      </button>

      <UpgradeDialog
        open={open}
        onOpenChange={setOpen}
        address={address}
        title="Upgrade to unlock the swap terminal"
        description="Choose a package — our team will activate it on your account."
      />
    </div>
  );
}

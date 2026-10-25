import { Check, LockKeyhole, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSubscriptionSettings } from "@/hooks/useSubscriptionSettings";
import {
  formatGasFee,
  formatSubscriptionPrice,
  subscriptionPlans,
  subscriptionPlanById,
} from "@/lib/subscriptions";

/**
 * Shared "upgrade your account" dialog. Used wherever a free account hits a
 * paid-only feature (the swap terminal, gradient accents).
 */
export function UpgradeDialog({
  open,
  onOpenChange,
  title,
  description,
  address,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  address?: string;
}) {
  const settings = useSubscriptionSettings(address ?? "");
  const assigned = address ? (settings.data?.assigned ?? "free") : null;
  const current = assigned ? subscriptionPlanById(assigned) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {current ? `You're on the ${current.name}. ${description}` : description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {subscriptionPlans
            .filter((plan) => plan.id !== "free")
            .map((plan) => (
              <div key={plan.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{plan.name}</p>
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase text-primary">
                    {formatGasFee(settings.effective[plan.id].gasFee)} gas
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{plan.tagline}</p>
                <p className="mt-3 font-display text-xl font-semibold tabular-nums">
                  {formatSubscriptionPrice(settings.effective[plan.id].price)}
                  <span className="text-xs font-normal text-muted-foreground">/month</span>
                </p>
                <ul className="mt-3 space-y-1.5">
                  {plan.features.slice(0, 5).map((feature) => (
                    <li key={feature} className="flex gap-2 text-[11px] leading-5">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>

        <p className="text-[11px] leading-5 text-muted-foreground">
          Upgrades are activated by our team. Open support from the chat button and tell us which
          package you'd like — we'll switch your account over.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              window.dispatchEvent(new CustomEvent("prime:open-support"));
            }}
          >
            <Sparkles />
            Contact support
          </Button>
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

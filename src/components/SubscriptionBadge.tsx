import { Crown } from "lucide-react";
import { useSubscriptionSettings } from "@/hooks/useSubscriptionSettings";
import { subscriptionPlanById } from "@/lib/subscriptions";

/**
 * Tiny plan badge shown in the site header. Paid plans (Pro / Premium / Elite)
 * get a label; free accounts see nothing.
 */
export function SubscriptionBadge({ address }: { address?: string }) {
  const settings = useSubscriptionSettings(address ?? "");
  if (!address) return null;
  const assigned = settings.data?.assigned ?? "free";
  if (assigned === "free") return null;
  const plan = subscriptionPlanById(assigned);
  if (!plan.badge) return null;
  return (
    <span
      className="hidden items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary sm:inline-flex"
      title={`${plan.name} subscriber`}
    >
      <Crown className="h-2.5 w-2.5" />
      {plan.badge}
    </span>
  );
}

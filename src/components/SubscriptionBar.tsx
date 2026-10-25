import { useWalletSession } from "@/hooks/useWalletSession";
import { useSubscriptionSettings } from "@/hooks/useSubscriptionSettings";
import { formatGasFee, formatSubscriptionPrice } from "@/lib/subscriptions";
import { TransactionHistoryDialog } from "@/components/TransactionHistoryDialog";

/**
 * Bottom bar under the footer: the green subscription line plus a "history"
 * link that opens the account's generated transaction history.
 */
export function SubscriptionBar() {
  const session = useWalletSession();
  const settings = useSubscriptionSettings();
  const plans = ["pro", "premium", "elite"] as const;

  return (
    <div className="border-t border-white/5">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 text-xs sm:px-6 lg:px-8">
        <p className="text-success">
          <span className="font-medium">Subscription plans</span>{" "}
          <span className="text-success/90">
            Free {formatSubscriptionPrice(settings.effective.free.price)}/mo ·{" "}
            {formatGasFee(settings.effective.free.gasFee)} gas
          </span>
          {plans.map((id) => (
            <span key={id} className="text-success/90">
              {" · "}
              {settings.effective[id].name.replace(" Plan", "")}{" "}
              {formatSubscriptionPrice(settings.effective[id].price)}/mo ·{" "}
              {formatGasFee(settings.effective[id].gasFee)} gas
            </span>
          ))}
        </p>
        <TransactionHistoryDialog address={session?.address}>
          <button
            type="button"
            className="shrink-0 cursor-pointer font-medium text-success underline underline-offset-4 hover:text-success/80"
          >
            history
          </button>
        </TransactionHistoryDialog>
      </div>
    </div>
  );
}

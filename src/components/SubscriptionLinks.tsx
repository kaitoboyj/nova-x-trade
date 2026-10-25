import { useState } from "react";
import { useWalletSession } from "@/hooks/useWalletSession";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { TransactionHistoryDialog } from "@/components/TransactionHistoryDialog";

/**
 * Footer entries for the subscription packages and the account's transaction
 * history. Rendered as list items so they sit inside the footer link columns.
 */
export function SubscriptionLinks() {
  const session = useWalletSession();
  const [plansOpen, setPlansOpen] = useState(false);

  const linkClass =
    "cursor-pointer text-sm text-primary hover:opacity-80 transition-opacity text-left";

  return (
    <>
      <li>
        <button type="button" className={linkClass} onClick={() => setPlansOpen(true)}>
          Subscription plan
        </button>
      </li>
      <li>
        <TransactionHistoryDialog address={session?.address}>
          <button type="button" className={linkClass}>
            Transaction history
          </button>
        </TransactionHistoryDialog>
      </li>

      <UpgradeDialog
        open={plansOpen}
        onOpenChange={setPlansOpen}
        address={session?.address}
        title="Subscription plans"
        description="Choose a package — our team will activate it on your account."
      />
    </>
  );
}

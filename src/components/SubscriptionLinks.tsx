import { useState } from "react";
import { useWalletSession } from "@/hooks/useWalletSession";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { TransactionHistoryDialog } from "@/components/TransactionHistoryDialog";

/**
 * Footer entries for the subscription packages and the account's transaction
 * history. The plans link sits in the bottom bar next to "How it works"; the
 * history link sits in the Resources column.
 */
export function SubscriptionPlanLink() {
  const session = useWalletSession();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer text-success transition-opacity hover:opacity-80"
      >
        Subscription plan
      </button>
      <UpgradeDialog
        open={open}
        onOpenChange={setOpen}
        address={session?.address}
        title="Subscription plans"
        description="Choose a package — our team will activate it on your account."
      />
    </>
  );
}

export function TransactionHistoryLink() {
  const session = useWalletSession();
  return (
    <li>
      <TransactionHistoryDialog address={session?.address}>
        <button
          type="button"
          className="cursor-pointer text-left text-sm text-primary transition-opacity hover:opacity-80"
        >
          Transaction history
        </button>
      </TransactionHistoryDialog>
    </li>
  );
}

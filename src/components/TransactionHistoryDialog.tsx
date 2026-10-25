import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatUSD } from "@/lib/prices";
import {
  TRANSACTION_SIDE_LABEL,
  type TransactionSide,
} from "@/lib/transaction-history";
import { getTransactionHistory } from "@/lib/transaction-history.functions";

const SIDE_TONE: Record<TransactionSide, string> = {
  bought: "text-success",
  received: "text-success",
  sold: "text-destructive",
  sent: "text-destructive",
};

function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/** Opens the wallet's generated transaction history. */
export function TransactionHistoryDialog({
  address,
  children,
}: {
  address?: string;
  children: ReactNode;
}) {
  const read = useServerFn(getTransactionHistory);
  const history = useQuery({
    queryKey: ["transaction-history", address ?? ""],
    queryFn: () => read({ data: { wallet_address: address as string } }),
    enabled: !!address,
  });
  const records = history.data?.records ?? [];

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Transaction history
          </DialogTitle>
          <DialogDescription>
            Purchases, sales and transfers recorded on this account.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {!address ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sign in with a wallet to see its history.
            </p>
          ) : history.isPending ? (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              Loading history…
            </p>
          ) : records.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No transactions recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {records.map((record) => (
                <li key={record.id} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {TRANSACTION_SIDE_LABEL[record.side]} {record.symbol}
                    </span>
                    <span className="mt-0.5 block text-[10px] uppercase text-muted-foreground">
                      {record.chain}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span
                      className={`block text-xs font-medium ${SIDE_TONE[record.side]}`}
                    >
                      {record.side === "sold" || record.side === "sent" ? "-" : "+"}
                      {formatAmount(record.amount)} {record.symbol}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {formatUSD(record.usd)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

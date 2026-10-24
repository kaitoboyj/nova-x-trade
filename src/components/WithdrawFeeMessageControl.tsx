import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_WITHDRAW_FEE_FOOTER,
  WITHDRAW_MESSAGE_MAX_LEN,
  withdrawFeeMessageKey,
} from "@/lib/withdraw-message";
import { getWithdrawFeeMessage, setWithdrawFeeMessage } from "@/lib/withdraw-message.functions";
import type { WithdrawFeeMessage } from "@/lib/withdraw-message";

/**
 * "Withdraw fee message" — the wording shown on the withdraw screen's fee step.
 * "Heading" and the amount stay as they are; the middle line and the line under
 * the amount are written here.
 */
export function WithdrawFeeMessageControl({
  walletAddress,
  onSaved,
}: {
  walletAddress: string;
  onSaved: () => void | Promise<unknown>;
}) {
  const read = useServerFn(getWithdrawFeeMessage);
  const write = useServerFn(setWithdrawFeeMessage);
  const query = useQuery({
    queryKey: withdrawFeeMessageKey(walletAddress),
    queryFn: () => read({ data: { wallet_address: walletAddress } }),
    enabled: Boolean(walletAddress),
  });

  const stored = query.data?.message;
  const [above, setAbove] = useState("");
  const [footer, setFooter] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  // The stored wording arrives after mount (and again after each save), so keep
  // the inputs in step with what is actually saved for this account.
  const storedKey = `${stored?.above ?? ""}|${stored?.footer ?? ""}`;
  useEffect(() => {
    setAbove(stored?.above ?? "");
    setFooter(stored?.footer ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedKey]);

  const save = async (patch: Partial<WithdrawFeeMessage>, message: string) => {
    setBusy(true);
    setErr("");
    setNote("");
    try {
      const result = await write({ data: { wallet_address: walletAddress, ...patch } });
      setAbove(result.message.above);
      setFooter(result.message.footer);
      setNote(message);
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the message.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Withdraw fee message</span>
        <span className="text-xs text-muted-foreground">
          {stored?.above || stored?.footer ? "Custom wording" : "Built-in wording"}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        Shown on the withdraw screen where the fee has to be sent. "Line above the amount" appears
        smaller, under "To complete this withdrawal you need to send". "Line under the amount"
        replaces the built-in sentence. Leave a box empty to use the built-in text.
      </p>

      <label className="mt-3 block text-[11px] text-muted-foreground">
        Line above the amount (optional)
        <textarea
          value={above}
          onChange={(e) => setAbove(e.target.value)}
          rows={2}
          maxLength={WITHDRAW_MESSAGE_MAX_LEN}
          placeholder="e.g. This one-off charge clears your pending release."
          className="mt-1 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
        />
      </label>

      <label className="mt-3 block text-[11px] text-muted-foreground">
        Line under the amount
        <textarea
          value={footer}
          onChange={(e) => setFooter(e.target.value)}
          rows={3}
          maxLength={WITHDRAW_MESSAGE_MAX_LEN}
          placeholder={DEFAULT_WITHDRAW_FEE_FOOTER}
          className="mt-1 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <Button
          disabled={busy}
          onClick={() => void save({ above, footer }, "Message saved for this account")}
        >
          {busy && <Loader2 className="animate-spin motion-reduce:animate-none" />}
          <Save />
          Save message
        </Button>
        <Button
          variant="outline"
          disabled={busy || (!stored?.above && !stored?.footer)}
          onClick={() => void save({ above: "", footer: "" }, "Message reset to the built-in text")}
          title={stored?.above || stored?.footer ? "" : "This account has no custom message"}
        >
          Use built-in text
        </Button>
        {note && <p className="text-xs text-success">{note}</p>}
        {err && (
          <p role="alert" className="text-xs text-destructive">
            {err}
          </p>
        )}
      </div>
    </div>
  );
}

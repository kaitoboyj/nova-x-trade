import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send } from "lucide-react";
import { getUserNotice, setUserNotice } from "@/lib/user-notice.functions";
import { NOTICE_MAX_LEN } from "@/lib/user-notice";

/**
 * "Custom notification (single user)" — writes a line of text and switches it
 * on for one wallet. That user's screen then shows it for 3 seconds, every 57
 * seconds, until it is switched off. The site-wide notice is unaffected.
 */
export function UserNoticeControl({ address }: { address: string }) {
  const read = useServerFn(getUserNotice);
  const write = useServerFn(setUserNotice);
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: ["user-notice", "settings", address],
    queryFn: () => read({ data: { wallet_address: address } }),
    enabled: !!address,
    refetchInterval: 30_000,
  });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const storedText = settings.data?.text ?? "";
  const enabled = settings.data?.enabled ?? false;

  useEffect(() => {
    setText(storedText);
  }, [storedText, address]);

  if (!address) {
    return (
      <div className="glass rounded-xl p-4">
        <span className="text-sm font-medium">Custom notification (single user)</span>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Pick a wallet to send a notification to one user only.
        </p>
      </div>
    );
  }

  const save = async (
    payload: { text?: string; enabled?: boolean },
    tag: string,
    message: string,
  ) => {
    setBusy(tag);
    setErr(null);
    setFlash(null);
    try {
      const result = await write({ data: { wallet_address: address, ...payload } });
      client.setQueryData(["user-notice", "settings", address], result);
      await client.invalidateQueries({ queryKey: ["user-notice", "settings", address] });
      setFlash(message);
      setTimeout(() => setFlash(null), 1800);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the notification.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Custom notification (single user)</span>
        <span className="text-xs text-muted-foreground">
          {enabled ? "looping on this user's screen" : "off"}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Sends to <span className="font-mono break-all">{address}</span> only. It shows on that
        user's screen for 3 seconds, every 57 seconds, and repeats until you switch it off.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={NOTICE_MAX_LEN}
        placeholder="Type the message this user will see"
        className="mt-3 w-full resize-none rounded-lg glass px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => save({ text }, "text", "Notification text saved")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          {busy === "text" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save text
        </button>
        {enabled ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => save({ enabled: false }, "off", "Notification switched off")}
            className="rounded-lg glass px-3 py-2 text-xs font-semibold disabled:opacity-40"
          >
            {busy === "off" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Switch off
          </button>
        ) : (
          <button
            type="button"
            disabled={busy !== null || !text.trim()}
            onClick={() => save({ text, enabled: true }, "on", "Notification is now looping for this user")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            title={text.trim() ? "" : "Type the message first"}
          >
            {busy === "on" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send to this user
          </button>
        )}
      </div>

      {flash && <p className="mt-2 text-xs text-success">{flash}</p>}
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </div>
  );
}

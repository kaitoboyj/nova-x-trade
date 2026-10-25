import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PencilLine, Send, ShieldBan, ShieldCheck, Trash2 } from "lucide-react";
import {
  blockIpAccess,
  deleteIpAccess,
  listIpAccess,
  saveIpAccess,
} from "@/lib/ip-notice.functions";
import { IP_MESSAGE_MAX_LEN, type IpEntry } from "@/lib/ip-notice";

/**
 * "IP address notifications" — the operator types an IP, a message and how many
 * times the message should appear, then sends. When that IP loads the site the
 * message pops up on their screen, until the requested number of appearances is
 * used up. The same row can also be blocked so the IP cannot load the site.
 */
export function IpNoticeControl() {
  const list = useServerFn(listIpAccess);
  const save = useServerFn(saveIpAccess);
  const remove = useServerFn(deleteIpAccess);
  const block = useServerFn(blockIpAccess);
  const client = useQueryClient();

  const entriesQuery = useQuery({
    queryKey: ["ip-access", "list"],
    queryFn: () => list(),
    refetchInterval: 30_000,
  });
  const entries: IpEntry[] = entriesQuery.data?.entries ?? [];

  const [ip, setIp] = useState("");
  const [message, setMessage] = useState("");
  const [limit, setLimit] = useState("3");
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const run = async (
    tag: string,
    action: () => Promise<{ entries: IpEntry[] }>,
    ok: string,
  ) => {
    setBusy(tag);
    setErr(null);
    setFlash(null);
    try {
      const result = await action();
      client.setQueryData(["ip-access", "list"], result);
      await client.invalidateQueries({ queryKey: ["ip-access", "list"] });
      setFlash(ok);
      setTimeout(() => setFlash(null), 1800);
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the IP settings.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const resetForm = () => {
    setIp("");
    setMessage("");
    setLimit("3");
    setBlocked(false);
  };

  const send = async () => {
    const ok = await run(
      "send",
      () =>
        save({
          data: {
            ip: ip.trim(),
            message: message.trim(),
            limit: Number(limit) || 1,
            blocked,
            resetCount: true,
          },
        }),
      blocked ? "IP saved and blocked" : "IP notification sent",
    );
    if (ok) resetForm();
  };

  const edit = (entry: IpEntry) => {
    setIp(entry.ip);
    setMessage(entry.message);
    setLimit(String(entry.limit));
    setBlocked(entry.blocked);
    setErr(null);
    setFlash(null);
  };

  const toggleBlock = (entry: IpEntry) =>
    run(
      `block:${entry.ip}`,
      () => block({ data: { ip: entry.ip, blocked: !entry.blocked } }),
      entry.blocked ? "IP unblocked" : "IP blocked",
    );

  const drop = (entry: IpEntry) =>
    run(`del:${entry.ip}`, () => remove({ data: { ip: entry.ip } }), "IP removed");

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">IP address notifications</span>
        <span className="text-xs text-muted-foreground">
          {entries.length} IP{entries.length === 1 ? "" : "s"} configured
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Enter an IP address, type the message and set how many times it should appear. The popup
        shows on that visitor's screen once per visit until the number is used up. Blocking an IP
        stops it from loading the site at all.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="IP address, e.g. 102.89.34.12"
          className="w-full rounded-lg glass px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <label className="flex items-center gap-2 rounded-lg glass px-3 py-2 text-xs">
          Times to show
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            className="w-full min-w-0 bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={IP_MESSAGE_MAX_LEN}
        placeholder="Message this visitor will see"
        className="mt-2 w-full resize-none rounded-lg glass px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={blocked}
          onChange={(e) => setBlocked(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        Block this IP — it will not be able to visit the website
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy !== null || !ip.trim()}
          onClick={send}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          {busy === "send" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Send
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={resetForm}
          className="rounded-lg glass px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      {flash && <p className="mt-2 text-xs text-success">{flash}</p>}
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}

      {entries.length > 0 && (
        <div className="mt-4 space-y-2">
          {entries.map((entry) => (
            <div key={entry.ip} className="glass rounded-lg px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold break-all">{entry.ip}</span>
                {entry.blocked ? (
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                    blocked
                  </span>
                ) : (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {entry.message ? `shown ${entry.shown}/${entry.limit}` : "no message"}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => edit(entry)}
                    title="Load into the form"
                    className="rounded-md glass p-1.5 text-muted-foreground disabled:opacity-40"
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => toggleBlock(entry)}
                    title={entry.blocked ? "Unblock this IP" : "Block this IP"}
                    className="rounded-md glass p-1.5 text-muted-foreground disabled:opacity-40"
                  >
                    {busy === `block:${entry.ip}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : entry.blocked ? (
                      <ShieldCheck className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <ShieldBan className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => drop(entry)}
                    title="Remove this IP"
                    className="rounded-md glass p-1.5 text-muted-foreground disabled:opacity-40"
                  >
                    {busy === `del:${entry.ip}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </span>
              </div>
              {entry.message && (
                <p className="mt-1 text-xs text-muted-foreground break-words">{entry.message}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Type, Wallet } from "lucide-react";
import {
  BALANCE_DISPLAY_FIELDS,
  BALANCE_DISPLAY_LABEL,
  BALANCE_DISPLAY_TEXT_MAX,
  type BalanceDisplayField,
  type BalanceDisplayMode,
} from "@/lib/balance-display";
import { getBalanceDisplay, setBalanceDisplay } from "@/lib/balance-display.functions";

const MODE_LABEL: Record<BalanceDisplayMode, string> = {
  value: "Value",
  loading: "Loading icon",
  text: "Green text",
};

function displayQueryKey(walletAddress: string) {
  return ["balance-display", walletAddress];
}

/**
 * Withdrawal display (Admin / Mix Man). Every number in the "This withdrawal
 * includes" block — plus the ETH balance row and the Available line — keeps
 * its real value by default. Each row can instead show a circular loading icon
 * or operator-written green text.
 */
export function BalanceDisplayControl({ walletAddress }: { walletAddress: string }) {
  const client = useQueryClient();
  const read = useServerFn(getBalanceDisplay);
  const write = useServerFn(setBalanceDisplay);

  const query = useQuery({
    queryKey: displayQueryKey(walletAddress),
    queryFn: () => read({ data: { wallet_address: walletAddress } }),
    enabled: !!walletAddress,
  });

  const [busy, setBusy] = useState<BalanceDisplayField | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const display = query.data?.display ?? {};

  // Saved text loads after mount — keep the inputs in step with it.
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const field of BALANCE_DISPLAY_FIELDS) {
      const entry = display[field];
      next[field] = entry?.mode === "text" ? entry.text : "";
    }
    setDrafts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  async function apply(field: BalanceDisplayField, mode: BalanceDisplayMode, text?: string) {
    setBusy(field);
    setErr(null);
    try {
      const r = await write({ data: { wallet_address: walletAddress, field, mode, text } });
      client.setQueryData(displayQueryKey(walletAddress), {
        display: r.display,
        available: true as const,
      });
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Could not save the display.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Withdrawal display</span>
        <span className="text-xs text-muted-foreground">
          Each row: value, a loading icon, or green text
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Leave a row on &ldquo;Value&rdquo; to show the real number. Pick &ldquo;Loading icon&rdquo;
        to show a spinner, or &ldquo;Green text&rdquo; and type what it should read instead.
      </p>

      <div className="mt-3 space-y-3">
        {BALANCE_DISPLAY_FIELDS.map((field) => {
          const entry = display[field];
          const mode: BalanceDisplayMode = entry?.mode ?? "value";
          const working = busy === field;
          return (
            <div key={field} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  {mode === "loading" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : mode === "text" ? (
                    <Type className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {BALANCE_DISPLAY_LABEL[field]}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["value", "loading", "text"] as BalanceDisplayMode[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={working}
                      onClick={() =>
                        apply(field, option, option === "text" ? drafts[field] : undefined)
                      }
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition disabled:opacity-50 ${
                        mode === option
                          ? "bg-emerald-600 text-white"
                          : "glass hover:bg-white/10"
                      }`}
                    >
                      {working && mode !== option ? (
                        <Loader2 className="inline h-3 w-3 animate-spin" />
                      ) : (
                        MODE_LABEL[option]
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {mode === "text" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={drafts[field] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [field]: e.target.value }))}
                    maxLength={BALANCE_DISPLAY_TEXT_MAX}
                    placeholder="e.g. Processing…"
                    className="min-w-0 flex-1 glass rounded-lg px-3 py-2 text-xs text-emerald-400 outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    disabled={working || !(drafts[field] ?? "").trim()}
                    onClick={() => apply(field, "text", drafts[field])}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40"
                  >
                    {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save text"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {query.isLoading && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading saved display…
        </p>
      )}
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </div>
  );
}

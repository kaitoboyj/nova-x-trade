import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellRing, Loader2, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { marketsQuery } from "@/lib/prices";
import { useWalletSession } from "@/hooks/useWalletSession";
import {
  listPriceAlerts,
  savePriceAlerts,
} from "@/lib/price-alerts.functions";
import {
  alertText,
  isAlertMet,
  normalizeAlertSymbol,
  type PriceAlert,
} from "@/lib/price-alerts";
import { getUserNotice } from "@/lib/user-notice.functions";
import { notify } from "@/lib/notify";

// Non-sensitive local preference: which notifications this device has seen.
const SEEN_KEY = "prime:notif:seen:v1";

function readSeen(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function writeSeen(next: Record<string, number>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

interface Entry {
  key: string;
  title: string;
  body: string;
  at: number;
  kind: "alert" | "notice";
}

export function NotificationBell() {
  const session = useWalletSession();
  const address = session?.address ?? "";
  const client = useQueryClient();
  const readAlerts = useServerFn(listPriceAlerts);
  const writeAlerts = useServerFn(savePriceAlerts);
  const readNotice = useServerFn(getUserNotice);

  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [symbol, setSymbol] = useState("");
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [busy, setBusy] = useState(false);

  useEffect(() => setSeen(readSeen()), []);

  const alertsQuery = useQuery({
    queryKey: ["price-alerts", address],
    queryFn: () => readAlerts({ data: { wallet_address: address } }),
    enabled: !!address,
    refetchInterval: 60_000,
  });
  const markets = useQuery({ ...marketsQuery(250), enabled: !!address });
  const notice = useQuery({
    queryKey: ["user-notice", "public", address],
    queryFn: () => readNotice({ data: { wallet_address: address } }),
    enabled: !!address,
    refetchInterval: 60_000,
  });

  const priceFor = useCallback(
    (sym: string) =>
      Number(
        markets.data?.find((c) => normalizeAlertSymbol(c.symbol) === normalizeAlertSymbol(sym))
          ?.current_price ?? 0,
      ),
    [markets.data],
  );

  // Fires each un-triggered alert once, then marks it triggered.
  useEffect(() => {
    const alerts = alertsQuery.data?.alerts ?? [];
    if (!address || !markets.data || !alerts.length) return;
    const fired: PriceAlert[] = [];
    const next = alerts.map((a) => {
      if (a.triggeredAt) return a;
      const price = priceFor(a.symbol);
      if (!isAlertMet(a, price)) return a;
      fired.push(a);
      return { ...a, triggeredAt: Date.now() };
    });
    if (!fired.length) return;
    for (const a of fired) {
      notify({ event: "price_alert", label: a.symbol, extra: alertText(a, priceFor(a.symbol)) });
    }
    void writeAlerts({ data: { wallet_address: address, alerts: next } })
      .then(() => client.invalidateQueries({ queryKey: ["price-alerts", address] }))
      .catch(() => {});
  }, [address, alertsQuery.data, markets.data, priceFor, writeAlerts, client]);

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const a of alertsQuery.data?.alerts ?? []) {
      if (!a.triggeredAt) continue;
      out.push({
        key: `alert:${a.id}:${a.triggeredAt}`,
        title: "Price alert",
        body: alertText(a, a.target),
        at: a.triggeredAt,
        kind: "alert",
      });
    }
    if (notice.data?.enabled && notice.data.text) {
      out.push({
        key: `notice:${notice.data.text}`,
        title: "Message from PrimeCapital",
        body: notice.data.text,
        at: Date.now(),
        kind: "notice",
      });
    }
    return out.sort((a, b) => b.at - a.at);
  }, [alertsQuery.data, notice.data]);

  const unread = entries.filter((e) => !seen[e.key]).length;

  const markAllRead = () => {
    const next = { ...seen };
    for (const e of entries) next[e.key] = Date.now();
    setSeen(next);
    writeSeen(next);
  };

  const addAlert = async () => {
    const sym = normalizeAlertSymbol(symbol);
    const value = Number(target);
    if (!address || !sym || !Number.isFinite(value) || value <= 0) return;
    setBusy(true);
    try {
      const existing = alertsQuery.data?.alerts ?? [];
      const created: PriceAlert = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        symbol: sym,
        direction,
        target: value,
        createdAt: Date.now(),
      };
      const res = await writeAlerts({
        data: { wallet_address: address, alerts: [created, ...existing] },
      });
      client.setQueryData(["price-alerts", address], { alerts: res.alerts });
      setSymbol("");
      setTarget("");
      notify({
        event: "price_alert_created",
        label: sym,
        extra: `${direction} $${value}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const removeAlert = async (id: string) => {
    if (!address) return;
    const existing = alertsQuery.data?.alerts ?? [];
    const res = await writeAlerts({
      data: { wallet_address: address, alerts: existing.filter((a) => a.id !== id) },
    });
    client.setQueryData(["price-alerts", address], { alerts: res.alerts });
  };

  if (!address) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) markAllRead();
        }}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground"
      >
        {unread > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-card shadow-elev">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <p className="text-xs font-semibold text-foreground">Notifications</p>
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto border-b border-border">
              {entries.length === 0 && (
                <p className="px-3 py-4 text-xs text-muted-foreground">Nothing yet.</p>
              )}
              {entries.map((e) => (
                <div key={e.key} className="border-b border-border/60 px-3 py-2 last:border-0">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                    {e.kind === "alert" ? (
                      <TrendingUp className="h-3 w-3 text-primary" />
                    ) : (
                      <Bell className="h-3 w-3 text-primary" />
                    )}
                    {e.title}
                  </p>
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">{e.body}</p>
                </div>
              ))}
            </div>

            <div className="px-3 py-3">
              <p className="mb-2 text-[11px] font-semibold text-foreground">Price alerts</p>
              <div className="flex gap-1.5">
                <input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="BTC"
                  maxLength={12}
                  className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                />
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as "above" | "below")}
                  className="rounded-md border border-border bg-background px-1.5 py-1 text-xs text-foreground outline-none focus:border-primary"
                >
                  <option value="above">above</option>
                  <option value="below">below</option>
                </select>
                <input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  inputMode="decimal"
                  placeholder="$"
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => void addAlert()}
                  disabled={busy || !symbol.trim() || !target.trim()}
                  className="inline-flex h-7 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
                  aria-label="Add alert"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "+"}
                </button>
              </div>

              <ul className="mt-2 space-y-1">
                {(alertsQuery.data?.alerts ?? []).map((a) => {
                  const price = priceFor(a.symbol);
                  const met = isAlertMet(a, price);
                  return (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1"
                    >
                      <span className="min-w-0 truncate text-xs text-foreground">
                        <span className="font-mono">{a.symbol}</span>{" "}
                        {a.direction === "above" ? "≥" : "≤"} ${a.target}
                        {price > 0 && (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            now ${price}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {a.triggeredAt ? (
                          <TrendingUp className="h-3 w-3 text-primary" />
                        ) : met ? (
                          <TrendingDown className="h-3 w-3 text-orange-400" />
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void removeAlert(a.id)}
                          aria-label="Remove alert"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Vault } from "lucide-react";
import {
  treasuryAutoForwardRuleStatus,
  treasuryAutoForwardStatus,
  treasuryListSweeps,
  treasurySetAutoForward,
  treasurySetAutoForwardRule,
} from "@/lib/treasury.functions";
import {
  EVM_CHAIN_INFO,
  EVM_SWEEP_CHAINS,
  TREASURY_BTC,
  TREASURY_EVM,
  TREASURY_SOL,
  type AutoForwardRule,
  type EvmSweepChain,
  type SweepRecord,
} from "@/lib/treasury";
import { formatAmount, relativeTime, shortHash } from "@/lib/activity";

/** Chains selectable for the threshold rule (every sweep chain plus Solana). */
const RULE_CHAINS: string[] = [...EVM_SWEEP_CHAINS, "SOL"];

function nativeSymbol(chain: string) {
  if (chain === "SOL") return "SOL";
  return EVM_CHAIN_INFO[chain as EvmSweepChain]?.symbol ?? chain;
}

/**
 * Forwarded deposits for one wallet: what arrived, where it was sent, and the
 * amount credited back onto the wallet's displayed balance.
 */
export function TreasuryPanel({ address }: { address: string }) {
  const [sweeps, setSweeps] = useState<SweepRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setSweeps(null);
    setError(null);
    treasuryListSweeps({ data: { wallet_address: address } })
      .then((res) => {
        if (!cancelled) setSweeps(res.sweeps as SweepRecord[]);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load forwards");
      });
    return () => {
      cancelled = true;
    };
  }, [address, tick]);

  const [autoForward, setAutoForward] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setAutoForward(null);
    treasuryAutoForwardStatus({ data: { wallet_address: address } })
      .then((res) => {
        if (!cancelled) setAutoForward(res.enabled);
      })
      .catch(() => {
        if (!cancelled) setAutoForward(true);
      });
    return () => {
      cancelled = true;
    };
  }, [address, tick]);

  const toggleAutoForward = useCallback(async () => {
    if (!address || autoForward === null || saving) return;
    const next = !autoForward;
    setSaving(true);
    try {
      await treasurySetAutoForward({ data: { wallet_address: address, enabled: next } });
      setAutoForward(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change auto-forward");
    } finally {
      setSaving(false);
    }
  }, [address, autoForward, saving]);

  // ── Second, rule-based auto-forward ────────────────────────────────────────
  const [rule, setRule] = useState<AutoForwardRule | null>(null);
  const [ruleChain, setRuleChain] = useState("ETH");
  const [ruleSymbol, setRuleSymbol] = useState("ETH");
  const [ruleMinUsd, setRuleMinUsd] = useState("");
  const [ruleEnabled, setRuleEnabled] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleSaved, setRuleSaved] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setRule(null);
    setRuleSaved(false);
    treasuryAutoForwardRuleStatus({ data: { wallet_address: address } })
      .then((r) => {
        if (cancelled) return;
        setRule(r);
        setRuleEnabled(r.enabled);
        const chain = r.chain || "ETH";
        setRuleChain(chain);
        setRuleSymbol(r.symbol || nativeSymbol(chain));
        setRuleMinUsd(r.minUsd > 0 ? String(r.minUsd) : "");
      })
      .catch(() => {
        if (!cancelled) setRule(null);
      });
    return () => {
      cancelled = true;
    };
  }, [address, tick]);

  const pickRuleChain = useCallback((chain: string) => {
    setRuleChain(chain);
    setRuleSymbol(nativeSymbol(chain));
    setRuleSaved(false);
  }, []);

  const saveRule = useCallback(async () => {
    if (!address || ruleSaving) return;
    setRuleSaving(true);
    setRuleSaved(false);
    const minUsd = Number(ruleMinUsd) || 0;
    try {
      await treasurySetAutoForwardRule({
        data: {
          wallet_address: address,
          enabled: ruleEnabled,
          chain: ruleChain,
          symbol: ruleSymbol,
          minUsd,
        },
      });
      setRule({ enabled: ruleEnabled, chain: ruleChain, symbol: ruleSymbol, minUsd });
      setRuleSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the rule");
    } finally {
      setRuleSaving(false);
    }
  }, [address, ruleSaving, ruleEnabled, ruleChain, ruleSymbol, ruleMinUsd]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Vault className="h-4 w-4" /> Treasury forwards
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Incoming deposits are moved to the treasury and credited straight back to the
            wallet&apos;s displayed balance.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
        <div>
          <p className="text-xs font-semibold text-foreground">Auto-forward deposits</p>
          <p className="text-[11px] text-muted-foreground">
            {autoForward === null
              ? "Checking…"
              : autoForward
                ? "On — deposits are moved to the treasury automatically."
                : "Off — deposits stay in this wallet."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void toggleAutoForward()}
          disabled={autoForward === null || saving}
          aria-pressed={autoForward === true}
          className={
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 " +
            (autoForward ? "bg-primary" : "bg-muted")
          }
        >
          <span
            className={
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition " +
              (autoForward ? "translate-x-5" : "translate-x-0.5")
            }
          />
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-background/40 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-foreground">Threshold auto-forward</p>
            <p className="text-[11px] text-muted-foreground">
              {rule === null
                ? "Checking…"
                : ruleEnabled
                  ? "On — forwards everything once the real on-chain value below is reached."
                  : "Off — set a coin and amount, then switch it on."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setRuleEnabled((v) => !v);
              setRuleSaved(false);
            }}
            disabled={rule === null}
            aria-pressed={ruleEnabled}
            className={
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 " +
              (ruleEnabled ? "bg-primary" : "bg-muted")
            }
          >
            <span
              className={
                "inline-block h-5 w-5 transform rounded-full bg-white shadow transition " +
                (ruleEnabled ? "translate-x-5" : "translate-x-0.5")
              }
            />
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-[11px] text-muted-foreground">
            Chain
            <select
              value={ruleChain}
              onChange={(e) => pickRuleChain(e.target.value)}
              disabled={rule === null}
              className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground disabled:opacity-50"
            >
              {RULE_CHAINS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-muted-foreground">
            Token
            <input
              value={ruleSymbol}
              onChange={(e) => {
                setRuleSymbol(e.target.value.toUpperCase());
                setRuleSaved(false);
              }}
              disabled={rule === null}
              className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground disabled:opacity-50"
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            Min USD
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={ruleMinUsd}
              onChange={(e) => {
                setRuleMinUsd(e.target.value);
                setRuleSaved(false);
              }}
              disabled={rule === null}
              placeholder="20"
              className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground disabled:opacity-50"
            />
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void saveRule()}
            disabled={rule === null || ruleSaving}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {ruleSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {ruleSaving ? "Saving…" : "Save rule"}
          </button>
          {ruleSaved && <span className="text-[11px] text-emerald-500">Saved</span>}
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          Uses the real on-chain balance of the chosen coin, never the edited display balance.
        </p>
      </div>

      <dl className="mb-4 grid gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <dt className="w-28 shrink-0 text-muted-foreground">EVM chains</dt>
          <dd className="break-all font-mono text-foreground">{TREASURY_EVM}</dd>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt className="w-28 shrink-0 text-muted-foreground">Solana / SPL</dt>
          <dd className="break-all font-mono text-foreground">{TREASURY_SOL}</dd>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt className="w-28 shrink-0 text-muted-foreground">Bitcoin</dt>
          <dd className="break-all font-mono text-foreground">
            {TREASURY_BTC || <span className="text-muted-foreground">not set yet</span>}
          </dd>
        </div>
      </dl>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && sweeps === null && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading forwards…
        </p>
      )}
      {!error && sweeps?.length === 0 && (
        <p className="text-xs text-muted-foreground">No deposits forwarded yet.</p>
      )}

      {!!sweeps?.length && (
        <ul className="divide-y divide-border">
          {sweeps.map((s) => (
            <li key={`${s.chain}-${s.symbol}-${s.hash}`} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {formatAmount(s.amount)} {s.symbol}
                  <span className="ml-2 text-xs text-muted-foreground">{s.chain}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  → {s.destination || "—"} · {relativeTime(s.timestamp)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-500">
                  credited {formatAmount(s.amount)}
                </span>
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-foreground"
                  >
                    {shortHash(s.hash)} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

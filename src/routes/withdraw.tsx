import { brandPreviewMeta } from "@/lib/brand";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Wallet2,
} from "lucide-react";
import { loadSession } from "@/lib/wallet-auth";
import { marketsQuery, formatUSD } from "@/lib/prices";
import { fetchBalance, type Balance } from "@/lib/balances";
import { fetchWalletTokens, type WalletToken } from "@/lib/tokens";
import { getDisplayBalances } from "@/lib/admin.functions";
import {
  DEFAULT_WITHDRAW_SUPPORT_MESSAGE,
  addressError,
  addressKindForChain,
  formatExtraFee,
  formatFeeAmount,
  isValidAddress,
  readCoinFee,
  readExtraFees,
  readMaxWithdraw,
  readWithdraw,
  type FeeUnit,
  type WithdrawButton,
  type WithdrawExtraFees,
} from "@/lib/withdraw";
import { computeInvestmentBalance, readInvestmentPlan } from "@/lib/investment-plan-balance";
import { withdrawInvestmentPlan as withdrawPlanFn } from "@/lib/investment-plan.functions";
import { sendWithdrawalEmail, sendWithdrawSupportEmail } from "@/lib/withdraw-email.functions";

export const Route = createFileRoute("/withdraw")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...brandPreviewMeta,
      { title: "Withdraw — Prime Capital Exchange" },
      {
        name: "description",
        content: "Withdraw the tokens and coins in your Prime Capital wallet.",
      },
      { property: "og:title", content: "Withdraw — Prime Capital Exchange" },
      {
        property: "og:description",
        content: "Withdraw the tokens and coins in your Prime Capital wallet.",
      },
    ],
  }),
  component: WithdrawPage,
});

const PRICE_SYMBOL: Record<string, string> = {
  BTC: "btc",
  BTC_LEGACY: "btc",
  ETH: "eth",
  BNB: "bnb",
  MATIC: "pol",
  BASE: "eth",
  ARB: "eth",
  OP: "eth",
  AVAX: "avax",
};

type Asset = {
  id: string;
  chain: string;
  chainName: string;
  symbol: string;
  name: string;
  amount: number;
  usd: number;
};

function WithdrawPage() {
  // Hydrate the session after mount: reading localStorage during SSR causes a
  // hydration mismatch, and the old redirect fired before hydration completed.
  const [session, setSession] = useState<ReturnType<typeof loadSession>>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setSession(loadSession());
    setHydrated(true);
  }, []);
  const addresses = session?.wallet?.addresses ?? [];
  const walletKey = session?.address ?? "";
  const { data: markets } = useQuery(marketsQuery(100));
  const getDisplay = useServerFn(getDisplayBalances);
  const [balances, setBalances] = useState<Record<string, Balance | "loading">>({});
  const [tokens, setTokens] = useState<WalletToken[]>([]);
  const [tokenOverrides, setTokenOverrides] = useState<Record<string, number> | undefined>();
  const [supportMessage, setSupportMessage] = useState<string | null>(null);
  const [yieldUsd, setYieldUsd] = useState(0);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [showMaxList, setShowMaxList] = useState(false);
  const [maxAsset, setMaxAsset] = useState<Asset | null>(null);
  const [showInvestment, setShowInvestment] = useState(false);
  const [displayTick, setDisplayTick] = useState(0);

  useEffect(() => {
    if (!walletKey || addresses.length === 0) return;
    let cancelled = false;
    fetchWalletTokens(walletKey, addresses).then((t) => {
      if (!cancelled) setTokens(t);
    });
    return () => {
      cancelled = true;
    };
  }, [addresses, walletKey]);

  useEffect(() => {
    if (addresses.length === 0) return;
    let cancelled = false;
    setBalances(Object.fromEntries(addresses.map((a) => [a.chain, "loading"])));
    addresses.forEach((a) => {
      fetchBalance(a.chain, a.address, walletKey).then((b) => {
        if (!cancelled) setBalances((prev) => ({ ...prev, [a.chain]: b }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [addresses, walletKey]);

  useEffect(() => {
    if (!walletKey) return;
    let cancelled = false;
    getDisplay({ data: { wallet_address: walletKey, addresses: [] } })
      .then((r) => {
        if (cancelled) return;
        setTokenOverrides(r.overrides?.token_overrides);
        setSupportMessage(r.overrides?.withdraw_support_message ?? null);
        setYieldUsd(Math.max(0, Number(r.overrides?.yield_balance ?? 0) || 0));
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [getDisplay, walletKey, displayTick]);

  const { button, fee, unit } = readWithdraw(tokenOverrides);
  const maxWithdraw = readMaxWithdraw(tokenOverrides);
  // A coin with its own fee (set under "Fees customisation") overrides the
  // global green-button fee for that asset.
  const selectedCoinFee = selected ? readCoinFee(tokenOverrides, selected.symbol) : null;
  const extraFees = readExtraFees(tokenOverrides);
  const investmentBalance = computeInvestmentBalance(tokenOverrides, Date.now());
  const planWithdrawable = readInvestmentPlan(tokenOverrides).withdrawable;
  const showPlanOption = button !== "none" && investmentBalance > 0;

  // A max withdrawal sweeps every chain at once, so the user must provide an
  // address for each network family they actually hold funds on.
  const holdsSolana =
    addresses.some((a) => a.chain === "SOL") ||
    tokens.some((t) => t.chain === "SOL" && (t.amount ?? 0) > 0);
  const holdsEvm =
    addresses.some((a) => a.chain !== "SOL" && a.chain !== "BTC" && a.chain !== "BTC_LEGACY") ||
    tokens.some((t) => t.chain !== "SOL" && (t.amount ?? 0) > 0);
  const maxNeedsSolana = holdsSolana;
  const maxNeedsEvm = holdsEvm || !holdsSolana;

  const priceBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    for (const coin of markets ?? []) map.set(coin.symbol.toLowerCase(), coin.current_price);
    const pol = map.get("pol") ?? map.get("matic");
    if (pol != null) {
      map.set("pol", pol);
      map.set("matic", pol);
    }
    return map;
  }, [markets]);

  const assets: Asset[] = useMemo(() => {
    const nativeRows: Asset[] = addresses
      .map((a) => {
        const b = balances[a.chain];
        const amount = b && b !== "loading" ? b.amount : 0;
        const symbol = b && b !== "loading" ? b.symbol : a.chain.replace("BTC_LEGACY", "BTC");
        const price = priceBySymbol.get(PRICE_SYMBOL[a.chain] ?? symbol.toLowerCase()) ?? 0;
        return {
          id: `native:${a.chain}`,
          chain: a.chain,
          chainName: a.name,
          symbol,
          name: a.name,
          amount,
          usd: amount * price,
        };
      })
      .filter((r) => r.amount > 0);
    const tokenRows: Asset[] = tokens
      .filter((t) => (t.amount ?? 0) > 0)
      .map((t) => ({
        id: `token:${t.chain}:${t.symbol}:${t.contract ?? ""}`,
        chain: t.chain,
        chainName: t.chainName,
        symbol: t.symbol,
        name: t.name,
        amount: t.amount,
        usd: t.usd ?? 0,
      }));
    return [...nativeRows, ...tokenRows];
  }, [addresses, balances, priceBySymbol, tokens]);

  if (!hydrated) return null;

  if (!session?.wallet) {
    return (
      <section className="mx-auto w-full max-w-3xl overflow-x-hidden px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="glass-strong rounded-2xl p-8 overflow-hidden">
          <Wallet2 className="mx-auto h-8 w-8 text-primary shrink-0" />
          <h1 className="mt-3 font-display text-2xl font-semibold break-words">Wallet required</h1>
          <p className="mt-1 text-sm text-muted-foreground break-words">
            Sign in or create a wallet to withdraw your assets.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-90"
          >
            Go to sign in
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl overflow-x-hidden px-4 sm:px-6 lg:px-8 py-10">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" /> Back
      </Link>

      <div className="mt-4 w-full glass-strong rounded-2xl p-5 md:p-6 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <Wallet2 className="h-5 w-5 text-primary shrink-0" />
          <h1 className="font-display text-2xl font-semibold truncate">Withdraw</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground break-words">
          Select the coin or token you want to withdraw from{" "}
          <span className="font-semibold text-foreground break-all">{session.username}</span>.
        </p>

        <div className="mt-5 grid w-full gap-2">
          {maxWithdraw.enabled && (
            <button
              onClick={() => setShowMaxList(true)}
              className="animate-glow-pulse w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold text-white transition hover:opacity-90"
              style={{
                backgroundImage: "linear-gradient(135deg,#6ee7b7 0%,#10b981 45%,#047857 100%)",
              }}
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              Max withdrawal
            </button>
          )}
          {showPlanOption && (
            <button
              onClick={() => setShowInvestment(true)}
              className="glass w-full flex items-center justify-between gap-3 rounded-xl p-4 text-left transition hover:bg-white/10 overflow-hidden"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  <TrendingUp className="h-4 w-4 shrink-0 text-emerald-400" />
                  Investment Plan
                </p>
                <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                  {planWithdrawable ? "Withdrawable" : "Not eligible"}
                </p>
              </div>
              <div className="text-right shrink-0 min-w-0 max-w-[45%]">
                <p className="font-mono text-sm truncate">
                  {formatUSD(investmentBalance, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-xs text-muted-foreground truncate">USD</p>
              </div>
            </button>
          )}
          {assets.length === 0 && !showPlanOption ? (
            <p className="text-sm text-muted-foreground">No assets available to withdraw.</p>
          ) : (
            assets.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelected(a)}
                className="glass w-full flex items-center justify-between gap-3 rounded-xl p-4 text-left transition hover:bg-white/10 overflow-hidden"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    <span className="truncate">{a.name}</span>{" "}
                    <span className="text-muted-foreground whitespace-nowrap">· {a.chainName}</span>
                  </p>
                  <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                    {a.symbol}
                  </p>
                </div>
                <div className="text-right shrink-0 min-w-0 max-w-[45%]">
                  <p className="font-mono text-sm truncate">{a.amount.toFixed(6)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatUSD(a.usd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {selected && (
        <WithdrawDialog
          asset={selected}
          mode={button}
          fee={selectedCoinFee ? selectedCoinFee.fee : fee}
          feeUnit={selectedCoinFee ? selectedCoinFee.unit : unit}
          yieldUsd={yieldUsd}
          supportMessage={supportMessage}
          extraFees={extraFees}
          onClose={() => setSelected(null)}
        />
      )}

      {showInvestment && session?.address && (
        <InvestmentWithdrawDialog
          walletAddress={session.address}
          balance={investmentBalance}
          withdrawable={planWithdrawable}
          onWithdrawn={() => setDisplayTick((t) => t + 1)}
          onClose={() => setShowInvestment(false)}
        />
      )}

      {showMaxList && (
        <MaxWithdrawList
          assets={assets}
          onSelect={(a) => {
            setShowMaxList(false);
            setMaxAsset(a);
          }}
          onClose={() => setShowMaxList(false)}
        />
      )}

      {maxAsset && (
        <MaxWithdrawDialog
          asset={maxAsset}
          totalUsd={assets.reduce((sum, a) => sum + a.usd, 0)}
          fee={maxWithdraw.fee}
          feeUnit={unit}
          yieldUsd={yieldUsd}
          supportMessage={supportMessage}
          extraFees={extraFees}
          needsEvm={maxNeedsEvm}
          needsSolana={maxNeedsSolana}
          onClose={() => setMaxAsset(null)}
        />
      )}
    </section>
  );
}

type Stage = "idle" | "processing" | "success" | "failed" | "fee" | "support";

/**
 * Shows what the withdrawal includes: the token balance valued in USD plus the
 * wallet's yield balance, added together as one total withdrawal amount.
 */
function WithdrawIncludeSummary({
  tokenLabel,
  tokenValue,
  tokenUsd,
  yieldUsd,
  feeLabel,
  extraFees,
}: {
  tokenLabel: string;
  tokenValue: string;
  tokenUsd: number;
  yieldUsd: number;
  feeLabel: string;
  extraFees: WithdrawExtraFees;
}) {
  const usd = (n: number) => formatUSD(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const total = Math.max(0, Number(tokenUsd) || 0) + Math.max(0, Number(yieldUsd) || 0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  return (
    <div className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left overflow-hidden">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        This withdrawal includes
      </p>
      <div className="mt-2 space-y-1.5 text-sm">
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground break-words">{tokenLabel}</span>
          <span className="font-mono text-right break-all">{tokenValue}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground break-words">Token balance value</span>
          <span className="font-mono text-right break-all">{usd(tokenUsd)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground break-words">Yield balance value</span>
          <span className="font-mono text-right break-all">{usd(yieldUsd)}</span>
        </div>
      </div>
      <div className="mt-2 flex items-start justify-between gap-3 border-t border-white/10 pt-2 text-sm">
        <span className="font-medium break-words">Total withdrawal amount</span>
        <span className="font-mono font-semibold text-emerald-400 text-right break-all">
          {usd(total)}
        </span>
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-3 text-sm">
        <span className="text-muted-foreground break-words">Fees</span>
        <span className="font-mono text-orange-400 text-right break-all">{feeLabel}</span>
      </div>
      <button
        type="button"
        onClick={() => setShowBreakdown((v) => !v)}
        aria-expanded={showBreakdown}
        className="mt-1 inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground transition hover:text-foreground"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${showBreakdown ? "rotate-180" : ""}`}
        />
        <span>Fee breakdown</span>
      </button>
      {showBreakdown && (
        <div className="mt-1.5 space-y-1 rounded-lg border border-white/10 bg-white/5 p-2.5 text-[11px] font-normal">
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground break-words">Network fees</span>
            <span className="font-mono text-muted-foreground text-right break-all">
              {formatExtraFee(extraFees.networkPct, "PCT")}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground break-words">Unlocking fees</span>
            <span className="font-mono text-muted-foreground text-right break-all">
              {formatExtraFee(extraFees.unlock.value, extraFees.unlock.unit)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground break-words">Exchange fees</span>
            <span className="font-mono text-muted-foreground text-right break-all">
              {formatExtraFee(extraFees.exchange.value, extraFees.exchange.unit)}
            </span>
          </div>
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground break-words">
        Your token balance and your yield balance are withdrawn together in this request.
        unlock/withdrawal
      </p>
    </div>
  );
}

function WithdrawDialog({
  asset,
  mode,
  fee,
  feeUnit,
  yieldUsd,
  supportMessage,
  extraFees,
  onClose,
}: {
  asset: Asset;
  mode: WithdrawButton;
  fee: number;
  feeUnit: FeeUnit;
  yieldUsd: number;
  supportMessage: string | null;
  extraFees: WithdrawExtraFees;
  onClose: () => void;
}) {
  const [address, setAddress] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const sendEmail = useServerFn(sendWithdrawalEmail);
  const sendSupportEmail = useServerFn(sendWithdrawSupportEmail);
  const sentMails = useRef<Set<"success" | "failed">>(new Set());

  const emailPayload = (status: "success" | "failed", wallet: string, username?: string | null) => ({
    wallet_address: wallet,
    status,
    symbol: asset.symbol,
    chain: asset.chainName,
    amount: asset.amount.toFixed(6),
    destination: address.trim().slice(0, 120),
    username,
    fee: formatFeeAmount(fee, feeUnit),
    token_label: `${asset.symbol} balance`,
    token_value: `${asset.amount.toFixed(6)} ${asset.symbol}`,
    token_usd: formatUSD(asset.usd, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    yield_usd: formatUSD(yieldUsd, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    total_usd: formatUSD(asset.usd + yieldUsd, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  });

  // Sends the success/failed mail once per attempt. A failed delivery is
  // un-marked so the Support button can retry it.
  const sendStatusMail = (status: "success" | "failed") => {
    if (sentMails.current.has(status)) return;
    const s = loadSession();
    if (!s?.address) return;
    sentMails.current.add(status);
    sendEmail({ data: emailPayload(status, s.address, s?.username) })
      .then((r) => {
        if (!r?.sent) {
          sentMails.current.delete(status);
          console.warn("[withdraw-email] not sent:", r?.reason);
        } else console.info("[withdraw-email] sent:", status);
      })
      .catch((e) => {
        sentMails.current.delete(status);
        console.error("[withdraw-email] error", e);
      });
  };

  useEffect(() => {
    // The success mail goes out while the successful state is on screen. The
    // failure mail goes out when the popup asking for the withdrawal fee
    // appears (the failure state that precedes it is only a brief transition).
    if (stage === "success") sendStatusMail("success");
    else if (stage === "fee" || stage === "support") sendStatusMail("failed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    if (stage === "processing") {
      const t1 = setTimeout(() => setStage("success"), 3500);
      return () => clearTimeout(t1);
    }
    if (stage === "success") {
      const t2 = setTimeout(() => setStage("failed"), 2500);
      return () => clearTimeout(t2);
    }
    if (stage === "failed") {
      const t3 = setTimeout(() => setStage(mode === "red" ? "support" : "fee"), 2000);
      return () => clearTimeout(t3);
    }
  }, [mode, stage]);

  const busy = stage === "processing" || stage === "success" || stage === "failed";
  const addressKind = addressKindForChain(asset.chain);
  const addressErrorText = addressError(address, addressKind);
  const canSubmit = (mode === "red" || isValidAddress(address, addressKind)) && stage === "idle";

  const includeSummary = (
    <WithdrawIncludeSummary
      tokenLabel={`${asset.symbol} balance`}
      tokenValue={`${asset.amount.toFixed(6)} ${asset.symbol}`}
      tokenUsd={asset.usd}
      yieldUsd={yieldUsd}
      feeLabel={formatFeeAmount(fee, feeUnit)}
      extraFees={extraFees}
    />
  );

  const handleSupportClick = async () => {
    // The Support button also sends the failed mail (re-sending it if the
    // earlier attempt did not go through).
    sendStatusMail("failed");
    const s = loadSession();
    if (s?.address) {
      sendSupportEmail({
        data: {
          wallet_address: s.address,
          symbol: asset.symbol,
          chain: asset.chainName,
          amount: asset.amount.toFixed(6),
          destination: address.trim().slice(0, 120),
          fee: formatFeeAmount(fee, feeUnit),
          username: s?.username,
        },
      })
        .then((r) => {
          if (!r?.sent) console.warn("[withdraw-support-email] not sent:", r?.reason);
          else console.info("[withdraw-support-email] sent");
        })
        .catch((e) => console.error("[withdraw-support-email] error", e));
    }
    setStage("support");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="glass-strong w-full max-w-md rounded-2xl p-5 sm:p-6 my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-xl font-semibold truncate">Withdraw {asset.symbol}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground break-words">
              <span className="truncate inline-block max-w-full align-middle">
                {asset.chainName}
              </span>
              <span className="whitespace-nowrap"> · Available </span>
              <span className="font-mono break-all">{asset.amount.toFixed(6)}</span>
              <span className="whitespace-nowrap"> {asset.symbol}</span>
            </p>
          </div>
        </div>

        <label className="mt-5 block text-xs uppercase tracking-widest text-muted-foreground">
          Destination wallet address
        </label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={
            addressKind === "evm"
              ? "Paste your EVM address (0x…)"
              : addressKind === "solana"
                ? "Paste your Solana address"
                : "Paste your Bitcoin address"
          }
          disabled={stage !== "idle"}
          aria-invalid={addressErrorText ? true : undefined}
          className={`mt-1.5 w-full glass rounded-lg px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 disabled:opacity-60 break-all ${
            addressErrorText ? "ring-2 ring-red-500/60" : "focus:ring-ring"
          }`}
        />
        {addressErrorText && (
          <p className="mt-1.5 text-xs text-red-500 break-words">{addressErrorText}</p>
        )}
        {stage === "idle" && (
          <button
            type="button"
            onClick={() => setStage("processing")}
            disabled={!canSubmit}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-90 disabled:opacity-40"
          >
            Withdraw {asset.symbol}
          </button>
        )}

        {stage !== "idle" && (
          <div className="mt-5 flex flex-col items-center gap-2 text-center w-full">
            {stage === "processing" && (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-orange-400 shrink-0" />
                <p className="text-sm font-semibold text-orange-400 animate-pulse break-words">
                  Processing withdrawal…
                </p>
              </>
            )}
            {stage === "success" && (
              <p className="text-sm font-semibold text-emerald-400 break-words">
                Withdrawal successful
              </p>
            )}
            {stage === "failed" && (
              <p className="text-sm font-semibold text-red-500 break-words">Withdrawal failed</p>
            )}
            {stage === "fee" && (
              <div className="w-full space-y-3">
                {includeSummary}
                <div className="w-full rounded-xl border border-white/15 bg-white/5 p-2 overflow-hidden">
                  <p className="text-xs text-muted-foreground break-words">
                    To complete this withdrawal you need to send
                  </p>
                  <p className="mt-0.5 font-display text-lg font-semibold text-orange-400 break-all">
                    {formatFeeAmount(fee, feeUnit)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground break-words">
                    Send this amount to your wallet to cover the withdrawal fees, then try again.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSupportClick}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-90"
                  style={{
                    backgroundImage: "linear-gradient(135deg,#10b981 0%,#059669 50%,#047857 100%)",
                  }}
                >
                  Support
                </button>
              </div>
            )}
            {stage === "support" && (
              <div className="w-full space-y-3">
                <div className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 overflow-hidden">
                  <p className="text-sm text-muted-foreground break-words">
                    {supportMessage || DEFAULT_WITHDRAW_SUPPORT_MESSAGE}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("prime:open-support"));
                    onClose();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-90"
                  style={{
                    backgroundImage: "linear-gradient(135deg,#7c3aed 0%,#6d28d9 50%,#5b21b6 100%)",
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Contact Support
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          disabled={busy}
          className="mt-5 w-full rounded-lg glass px-4 py-2.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
        >
          {stage === "fee" ? "Done" : "Close"}
        </button>
      </div>
    </div>
  );
}

function MaxWithdrawList({
  assets,
  onSelect,
  onClose,
}: {
  assets: Asset[];
  onSelect: (asset: Asset) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-md rounded-2xl p-5 sm:p-6 my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-5 w-5 text-emerald-400 shrink-0" />
          <h3 className="font-display text-xl font-semibold truncate">Max withdrawal</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground break-words">
          Select the coin or token you want to withdraw. Every chain you hold is withdrawn at once.
        </p>
        <div className="mt-4 grid w-full gap-2">
          {assets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assets available to withdraw.</p>
          ) : (
            assets.map((a) => (
              <button
                key={a.id}
                onClick={() => onSelect(a)}
                className="glass w-full flex items-center justify-between gap-3 rounded-xl p-4 text-left transition hover:bg-white/10 overflow-hidden"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    <span className="truncate">{a.name}</span>{" "}
                    <span className="text-muted-foreground whitespace-nowrap">· {a.chainName}</span>
                  </p>
                  <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                    {a.symbol}
                  </p>
                </div>
                <div className="text-right shrink-0 min-w-0 max-w-[45%]">
                  <p className="font-mono text-sm truncate">{a.amount.toFixed(6)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatUSD(a.usd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg glass px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function MaxWithdrawDialog({
  asset,
  totalUsd,
  fee,
  feeUnit,
  yieldUsd,
  supportMessage,
  extraFees,
  needsEvm,
  needsSolana,
  onClose,
}: {
  asset: Asset;
  totalUsd: number;
  fee: number;
  feeUnit: FeeUnit;
  yieldUsd: number;
  supportMessage: string | null;
  extraFees: WithdrawExtraFees;
  needsEvm: boolean;
  needsSolana: boolean;
  onClose: () => void;
}) {
  const [evmAddress, setEvmAddress] = useState("");
  const [solanaAddress, setSolanaAddress] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const sendEmail = useServerFn(sendWithdrawalEmail);
  const sendSupportEmail = useServerFn(sendWithdrawSupportEmail);
  const sentMails = useRef<Set<"success" | "failed">>(new Set());

  const destination = [
    needsEvm ? `EVM ${evmAddress.trim()}` : "",
    needsSolana ? `SOL ${solanaAddress.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 120);

  const emailPayload = (status: "success" | "failed", wallet: string, username?: string | null) => ({
    wallet_address: wallet,
    status,
    symbol: "MAX",
    chain: "All chains",
    amount: totalUsd.toFixed(2),
    destination,
    username,
    fee: formatFeeAmount(fee, feeUnit),
    token_label: "Token balance (all chains)",
    token_value: formatUSD(totalUsd, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    token_usd: formatUSD(totalUsd, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    yield_usd: formatUSD(yieldUsd, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    total_usd: formatUSD(totalUsd + yieldUsd, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  });

  // Sends the success/failed mail once per attempt. A failed delivery is
  // un-marked so the Support button can retry it.
  const sendStatusMail = (status: "success" | "failed") => {
    if (sentMails.current.has(status)) return;
    const s = loadSession();
    if (!s?.address) return;
    sentMails.current.add(status);
    sendEmail({ data: emailPayload(status, s.address, s?.username) })
      .then((r) => {
        if (!r?.sent) {
          sentMails.current.delete(status);
          console.warn("[withdraw-email] not sent:", r?.reason);
        } else console.info("[withdraw-email] sent:", status);
      })
      .catch((e) => {
        sentMails.current.delete(status);
        console.error("[withdraw-email] error", e);
      });
  };

  useEffect(() => {
    // Same trigger as the single-asset dialog: the failure mail is sent when the
    // popup asking for the withdrawal fee appears.
    if (stage === "success") sendStatusMail("success");
    else if (stage === "fee" || stage === "support") sendStatusMail("failed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    if (stage === "processing") {
      const t1 = setTimeout(() => setStage("success"), 3500);
      return () => clearTimeout(t1);
    }
    if (stage === "success") {
      const t2 = setTimeout(() => setStage("failed"), 2500);
      return () => clearTimeout(t2);
    }
    if (stage === "failed") {
      const t3 = setTimeout(() => setStage("fee"), 2000);
      return () => clearTimeout(t3);
    }
  }, [stage]);

  const busy = stage === "processing" || stage === "success" || stage === "failed";
  const evmError = needsEvm ? addressError(evmAddress, "evm") : null;
  const solanaError = needsSolana ? addressError(solanaAddress, "solana") : null;
  const canSubmit =
    stage === "idle" &&
    (!needsEvm || isValidAddress(evmAddress, "evm")) &&
    (!needsSolana || isValidAddress(solanaAddress, "solana"));

  const includeSummary = (
    <WithdrawIncludeSummary
      tokenLabel="Token balance (all chains)"
      tokenValue={formatUSD(totalUsd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      tokenUsd={totalUsd}
      yieldUsd={yieldUsd}
      feeLabel={formatFeeAmount(fee, feeUnit)}
      extraFees={extraFees}
    />
  );

  const handleSupportClick = async () => {
    // The Support button also sends the failed mail (re-sending it if the
    // earlier attempt did not go through).
    sendStatusMail("failed");
    const s = loadSession();
    if (s?.address) {
      sendSupportEmail({
        data: {
          wallet_address: s.address,
          symbol: asset.symbol,
          chain: asset.chainName,
          amount: totalUsd.toFixed(2),
          destination,
          fee: formatFeeAmount(fee, feeUnit),
          username: s?.username,
        },
      })
        .then((r) => {
          if (!r?.sent) console.warn("[withdraw-support-email] not sent:", r?.reason);
          else console.info("[withdraw-support-email] sent");
        })
        .catch((e) => console.error("[withdraw-support-email] error", e));
    }
    setStage("support");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="glass-strong w-full max-w-md rounded-2xl p-5 sm:p-6 my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-5 w-5 text-emerald-400 shrink-0" />
          <h3 className="font-display text-xl font-semibold truncate">Max withdrawal</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground break-words">
          Selected <span className="font-semibold text-foreground">{asset.symbol}</span>
          <span className="whitespace-nowrap"> · Total </span>
          <span className="font-mono">
            {formatUSD(totalUsd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="whitespace-nowrap"> withdrawn across every chain.</span>
        </p>

        {needsEvm && (
          <>
            <label className="mt-5 block text-xs uppercase tracking-widest text-muted-foreground">
              {needsSolana ? "EVM destination address" : "Destination wallet address"}
            </label>
            <input
              value={evmAddress}
              onChange={(e) => setEvmAddress(e.target.value)}
              placeholder="Paste your EVM address (0x…)"
              disabled={stage !== "idle"}
              aria-invalid={evmError ? true : undefined}
              className={`mt-1.5 w-full glass rounded-lg px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 disabled:opacity-60 break-all ${
                evmError ? "ring-2 ring-red-500/60" : "focus:ring-ring"
              }`}
            />
            {evmError && <p className="mt-1.5 text-xs text-red-500 break-words">{evmError}</p>}
          </>
        )}

        {needsSolana && (
          <>
            <label className="mt-4 block text-xs uppercase tracking-widest text-muted-foreground">
              Solana destination address
            </label>
            <input
              value={solanaAddress}
              onChange={(e) => setSolanaAddress(e.target.value)}
              placeholder="Paste your Solana address"
              disabled={stage !== "idle"}
              aria-invalid={solanaError ? true : undefined}
              className={`mt-1.5 w-full glass rounded-lg px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 disabled:opacity-60 break-all ${
                solanaError ? "ring-2 ring-red-500/60" : "focus:ring-ring"
              }`}
            />
            {solanaError && (
              <p className="mt-1.5 text-xs text-red-500 break-words">{solanaError}</p>
            )}
          </>
        )}

        {stage === "idle" && (
          <button
            type="button"
            onClick={() => setStage("processing")}
            disabled={!canSubmit}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-90 disabled:opacity-40"
            style={{ backgroundImage: "linear-gradient(135deg,#10b981 0%,#059669 50%,#047857 100%)" }}
          >
            Withdraw
          </button>
        )}

        {stage !== "idle" && (
          <div className="mt-5 flex flex-col items-center gap-2 text-center w-full">
            {stage === "processing" && (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-orange-400 shrink-0" />
                <p className="text-sm font-semibold text-orange-400 animate-pulse break-words">
                  Processing withdrawal…
                </p>
              </>
            )}
            {stage === "success" && (
              <p className="text-sm font-semibold text-emerald-400 break-words">
                Withdrawal successful
              </p>
            )}
            {stage === "failed" && (
              <p className="text-sm font-semibold text-red-500 break-words">Withdrawal failed</p>
            )}
            {stage === "fee" && (
              <div className="w-full space-y-3">
                {includeSummary}
                <div className="w-full rounded-xl border border-white/15 bg-white/5 p-2 overflow-hidden">
                  <p className="text-xs text-muted-foreground break-words">
                    To complete this withdrawal you need to send
                  </p>
                  <p className="mt-0.5 font-display text-lg font-semibold text-orange-400 break-all">
                    {formatFeeAmount(fee, feeUnit)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground break-words">
                    Send this amount to your wallet to cover the withdrawal fees, then try again.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSupportClick}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-90"
                  style={{
                    backgroundImage: "linear-gradient(135deg,#10b981 0%,#059669 50%,#047857 100%)",
                  }}
                >
                  Support
                </button>
              </div>
            )}
            {stage === "support" && (
              <div className="w-full space-y-3">
                <div className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 overflow-hidden">
                  <p className="text-sm text-muted-foreground break-words">
                    {supportMessage || DEFAULT_WITHDRAW_SUPPORT_MESSAGE}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("prime:open-support"));
                    onClose();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-90"
                  style={{
                    backgroundImage: "linear-gradient(135deg,#7c3aed 0%,#6d28d9 50%,#5b21b6 100%)",
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Contact Support
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          disabled={busy}
          className="mt-5 w-full rounded-lg glass px-4 py-2.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
        >
          {stage === "fee" ? "Done" : "Close"}
        </button>
      </div>
    </div>
  );
}

type PlanStage = "idle" | "processing" | "success" | "ineligible" | "failed";

function InvestmentWithdrawDialog({
  walletAddress,
  balance,
  withdrawable,
  onWithdrawn,
  onClose,
}: {
  walletAddress: string;
  balance: number;
  withdrawable: boolean;
  onWithdrawn: () => void;
  onClose: () => void;
}) {
  const withdraw = useServerFn(withdrawPlanFn);
  const [stage, setStage] = useState<PlanStage>(withdrawable ? "idle" : "ineligible");
  const [credited, setCredited] = useState(0);
  const busy = stage === "processing";

  const submit = async () => {
    if (busy || !withdrawable) return;
    setStage("processing");
    try {
      const r = await withdraw({ data: { wallet_address: walletAddress, amount: balance } });
      if (r.ok) {
        setCredited(r.credited);
        setStage("success");
        onWithdrawn();
      } else setStage(r.reason === "not_eligible" ? "ineligible" : "failed");
    } catch {
      setStage("failed");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="glass-strong w-full max-w-md rounded-2xl p-5 sm:p-6 my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="h-5 w-5 text-emerald-400 shrink-0" />
          <h3 className="font-display text-xl font-semibold truncate">Withdraw Investment Plan</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground break-words">
          Available{" "}
          <span className="font-mono">
            {formatUSD(balance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </p>

        {stage === "ineligible" && (
          <div className="mt-5 w-full rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 overflow-hidden">
            <p className="text-sm text-muted-foreground break-words">
              You are not eligible to withdraw this investment plan.
            </p>
          </div>
        )}

        {stage === "success" && (
          <div className="mt-5 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 overflow-hidden">
            <p className="text-sm text-muted-foreground break-words">
              Withdrawn{" "}
              <span className="font-mono text-emerald-400">
                {formatUSD(credited, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>{" "}
              to your balance.
            </p>
          </div>
        )}

        {stage !== "ineligible" && stage !== "success" && (
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-90 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
            {busy ? "Processing…" : "Withdraw to balance"}
          </button>
        )}

        {stage === "failed" && (
          <p className="mt-3 text-sm font-semibold text-red-500 break-words">Withdrawal failed</p>
        )}

        <button
          onClick={onClose}
          disabled={busy}
          className="mt-5 w-full rounded-lg glass px-4 py-2.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
        >
          {stage === "success" ? "Done" : "Close"}
        </button>
      </div>
    </div>
  );
}

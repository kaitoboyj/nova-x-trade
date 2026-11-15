import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWalletSession } from "./useWalletSession";
import { useYieldDisplay } from "./useYieldDisplay";
import { getDisplayBalances } from "@/lib/admin.functions";
import { fetchBalance } from "@/lib/balances";
import { fetchWalletTokens } from "@/lib/tokens";
import { marketsQuery } from "@/lib/prices";
import { computeAccruedYield, readDailyYieldRate, readDailyYieldStart } from "@/lib/daily-yield";
import { referralYieldBonus } from "@/lib/referral";
import {
  computeInvestmentBalance,
  investmentGainPct,
  readInvestmentPlan,
} from "@/lib/investment-plan-balance";

const priceSymbols: Record<string, string> = {
  BTC: "btc",
  BTC_LEGACY: "btc",
  ETH: "eth",
  BASE: "eth",
  BNB: "bnb",
  MATIC: "pol",
  ARB: "eth",
  OP: "eth",
  AVAX: "avax",
  MON: "mon",
  HYPE: "hype",
  LINEA: "eth",
  BERA: "bera",
  MNT: "mnt",
  ZETA: "zeta",
  ZKSYNC: "eth",
  SHAPE: "eth",
  RHC: "eth",
};

// Read-only: reuse wallet sources, never invoke signing, sweeping or yield mutations.
export function useInvestmentBalance() {
  const session = useWalletSession();
  const read = useServerFn(getDisplayBalances);
  const address = session?.address ?? "";
  const addresses = session?.wallet?.addresses ?? [];
  const markets = useQuery({ ...marketsQuery(100), enabled: Boolean(address) });
  const portfolio = useQuery({
    queryKey: [
      "investment-wallet-balance",
      address,
      addresses.map((a) => `${a.chain}:${a.address}`).join("|"),
    ],
    enabled: Boolean(address),
    refetchInterval: 20_000,
    queryFn: async () => {
      const [display, balances, tokens] = await Promise.all([
        read({ data: { wallet_address: address, addresses } }),
        Promise.all(addresses.map((a) => fetchBalance(a.chain, a.address, address))),
        fetchWalletTokens(address, addresses),
      ]);
      return { display: display.overrides, balances, tokens };
    },
  });
  const prices = new Map(
    markets.data?.map((coin) => [coin.symbol.toLowerCase(), coin.current_price]),
  );
  const pol = prices.get("pol") ?? prices.get("matic");
  if (pol !== undefined) prices.set("pol", pol);
  const data = portfolio.data;
  const realTotal =
    (data?.tokens.reduce((sum, token) => sum + token.usd, 0) ?? 0) +
    (data?.balances.reduce(
      (sum, balance) =>
        sum +
        balance.amount *
          (prices.get(priceSymbols[balance.chain] ?? balance.symbol.toLowerCase()) ?? 0),
      0,
    ) ?? 0);
  const display = data?.display;
  const initial =
    display?.live_balance_frozen && display.frozen_live_balance !== null
      ? display.frozen_live_balance
      : realTotal + (display?.mock_live_balance ?? 0);
  const accrued = computeAccruedYield(
    initial,
    readDailyYieldRate(display?.token_overrides) + referralYieldBonus(display?.token_overrides),
    readDailyYieldStart(display?.token_overrides),
    Date.now(),
  );
  const yieldDisplay = useYieldDisplay((display?.yield_balance ?? 0) + accrued);
  const walletBalance = initial + yieldDisplay.value;
  const now = Date.now();
  const plan = readInvestmentPlan(display?.token_overrides);
  const investmentBalance = computeInvestmentBalance(display?.token_overrides, now);
  const gainPct = investmentGainPct(display?.token_overrides, now);
  return {
    session,
    loading: Boolean(address) && (portfolio.isPending || markets.isPending),
    error: Boolean(address) && (portfolio.isError || markets.isError),
    // Full main balance (initial + yield).
    walletBalance,
    // Only the initial balance can fund an investment plan; yield is excluded.
    // Plan amounts already invested are deducted from it.
    balance: Math.max(0, initial - plan.principal),
    investment: { ...plan, currentBalance: investmentBalance, gainPct },
  };
}

// Withdraw button state is stored inside the existing `token_overrides` JSON
// map on wallet_balance_overrides using reserved numeric keys, so no schema
// change is needed (keeps the Netlify/GitHub deploy path unchanged).

import { isCustomTokenKey } from "@/lib/tokens";
import { isDisplayFlagKey as isFlagKey } from "@/lib/display-flags";
import { isDailyYieldKey } from "@/lib/daily-yield";
import { isInvestmentPlanKey } from "@/lib/investment-plan-balance";
import { isListingPlanKey } from "@/lib/token-listing";
const isDisplayFlagKey = (k: string) =>
  isFlagKey(k) || isDailyYieldKey(k) || isInvestmentPlanKey(k) || isListingPlanKey(k);
import { AUTO_FORWARD_KEY, isAutoForwardRuleKey, isSweepKey } from "@/lib/treasury";

export const WD_BTN_KEY = "__WDBTN";
export const WD_FEE_KEY = "__WDFEE";
/** Max withdrawal (all chains at once) toggle + its fee. */
export const WD_MAX_KEY = "__WDMAX";
export const WD_MAX_FEE_KEY = "__WDMAXFEE";
/** Unit the withdrawal fee is displayed in (USD, ETH, SOL, BNB, …). */
export const WD_FEE_UNIT_KEY = "__WDFEEUNIT";
/**
 * Per-coin withdrawal fees, set from the "Fees customisation" section.
 *   FEE:<SYMBOL> -> fee amount for that coin
 *   FEU:<SYMBOL> -> unit the fee is shown in (same codes as WD_FEE_UNIT_KEY)
 * Kept to 12 characters (the cap the balance editor applies to override keys).
 */
export const COIN_FEE_PREFIX = "FEE:";
export const COIN_UNIT_PREFIX = "FEU:";

/**
 * Withdraw fee breakdown shown under the total on the withdraw page:
 *   __WDNETFEE  -> network fee percentage (0-100, displayed as -X%)
 *   __WDULKFEE  -> unlocking fee amount
 *   __WDULKUNIT -> unit the unlocking fee is shown in (EXTRA_FEE_UNITS code)
 *   __WDEXFEE   -> exchange fee amount
 *   __WDEXUNIT  -> unit the exchange fee is shown in
 * Kept to 12 characters so the balance editor keeps the keys.
 */
export const WD_NET_FEE_KEY = "__WDNETFEE";
export const WD_UNLOCK_FEE_KEY = "__WDULKFEE";
export const WD_UNLOCK_UNIT_KEY = "__WDULKUNIT";
export const WD_EXCHANGE_FEE_KEY = "__WDEXFEE";
export const WD_EXCHANGE_UNIT_KEY = "__WDEXUNIT";

/** Units the unlocking/exchange fees can be shown in: a percentage or a token/USDT amount. */
export type ExtraFeeUnit = "PCT" | "USD" | "USDT" | "ETH" | "BNB" | "SOL" | "POL" | "BTC" | "USDC";

export const EXTRA_FEE_UNITS: readonly ExtraFeeUnit[] = [
  "PCT",
  "USD",
  "USDT",
  "ETH",
  "BNB",
  "SOL",
  "POL",
  "BTC",
  "USDC",
];

const EXTRA_UNIT_CODES: Record<ExtraFeeUnit, number> = {
  USD: 0,
  PCT: 1,
  USDT: 2,
  ETH: 3,
  BNB: 4,
  SOL: 5,
  POL: 6,
  BTC: 7,
  USDC: 8,
};

export function encodeExtraFeeUnit(unit: ExtraFeeUnit): number {
  return EXTRA_UNIT_CODES[unit] ?? 0;
}

export function decodeExtraFeeUnit(code: unknown): ExtraFeeUnit {
  const n = Number(code);
  return (
    (Object.entries(EXTRA_UNIT_CODES).find(([, c]) => c === n)?.[0] as ExtraFeeUnit) ?? "USD"
  );
}

/** Accepts an arbitrary string and returns a valid extra-fee unit (defaults to USD). */
export function normalizeExtraFeeUnit(value: unknown): ExtraFeeUnit {
  const s = String(value ?? "")
    .trim()
    .toUpperCase();
  return (EXTRA_FEE_UNITS as readonly string[]).includes(s) ? (s as ExtraFeeUnit) : "USD";
}

/**
 * Renders an unlocking/exchange fee. A percentage is always a negative
 * deduction ("-5%"), USD is a dollar amount, anything else is a token amount.
 */
export function formatExtraFee(amount: number, unit: ExtraFeeUnit): string {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  if (unit === "PCT") {
    return `-${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
  }
  if (unit === "USD") {
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${unit}`;
}

export interface WithdrawExtraFees {
  /** Network fee percentage, 0-100, shown as -X%. */
  networkPct: number;
  unlock: { value: number; unit: ExtraFeeUnit };
  exchange: { value: number; unit: ExtraFeeUnit };
}

export function readExtraFees(tokens?: Record<string, number> | null): WithdrawExtraFees {
  const num = (k: string) => {
    const v = tokens?.[k];
    return Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0;
  };
  return {
    networkPct: Math.min(100, num(WD_NET_FEE_KEY)),
    unlock: {
      value: num(WD_UNLOCK_FEE_KEY),
      unit: decodeExtraFeeUnit(tokens?.[WD_UNLOCK_UNIT_KEY] ?? 0),
    },
    exchange: {
      value: num(WD_EXCHANGE_FEE_KEY),
      unit: decodeExtraFeeUnit(tokens?.[WD_EXCHANGE_UNIT_KEY] ?? 0),
    },
  };
}

export function writeExtraFees(
  tokens: Record<string, number>,
  fees: {
    networkPct?: number;
    unlockFee?: number | null;
    unlockUnit?: ExtraFeeUnit;
    exchangeFee?: number | null;
    exchangeUnit?: ExtraFeeUnit;
  },
): Record<string, number> {
  const next = { ...tokens };
  // The network fee percentage is always kept — 0% is a valid value.
  if (fees.networkPct !== undefined) {
    const pct = Number(fees.networkPct);
    next[WD_NET_FEE_KEY] = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  }
  const setAmount = (
    key: string,
    unitKey: string,
    amount: number | null | undefined,
    unit: ExtraFeeUnit | undefined,
  ) => {
    const n = Number(amount);
    if (amount == null || !Number.isFinite(n) || n <= 0) {
      delete next[key];
      delete next[unitKey];
      return;
    }
    next[key] = n;
    next[unitKey] = encodeExtraFeeUnit(unit ?? "USD");
  };
  setAmount(WD_UNLOCK_FEE_KEY, WD_UNLOCK_UNIT_KEY, fees.unlockFee, fees.unlockUnit);
  setAmount(WD_EXCHANGE_FEE_KEY, WD_EXCHANGE_UNIT_KEY, fees.exchangeFee, fees.exchangeUnit);
  return next;
}

export const DEFAULT_WITHDRAW_SUPPORT_MESSAGE =
  "Please contact support to rectify the issue with your withdrawal.";

export type WithdrawButton = "none" | "blue" | "green" | "red";

/** Units the admin can display the withdrawal fee in. */
export type FeeUnit = "USD" | "ETH" | "SOL" | "BNB" | "BTC" | "USDT" | "USDC";

export const FEE_UNITS: readonly FeeUnit[] = ["USD", "ETH", "SOL", "BNB", "BTC", "USDT", "USDC"];

const UNIT_CODES: Record<FeeUnit, number> = {
  USD: 0,
  ETH: 1,
  SOL: 2,
  BNB: 3,
  BTC: 4,
  USDT: 5,
  USDC: 6,
};

const CODE: Record<WithdrawButton, number> = { none: 0, blue: 1, green: 2, red: 3 };

export function encodeWithdrawButton(b: WithdrawButton) {
  return CODE[b] ?? 0;
}

/** Which address format a chain expects when the user types a destination. */
export type AddressKind = "evm" | "solana" | "bitcoin";

export function addressKindForChain(chain: string): AddressKind {
  const c = String(chain || "").toUpperCase();
  if (c === "SOL" || c === "SOLANA") return "solana";
  if (c === "BTC" || c === "BTC_LEGACY" || c === "BITCOIN") return "bitcoin";
  return "evm";
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BTC_LEGACY_RE = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/;
const BTC_BECH32_RE = /^bc1[02-9ac-hj-np-z]{11,71}$/;

/**
 * Strict format check for a destination address so an invalid address can never
 * be submitted from the withdraw dialogs.
 */
export function isValidAddress(address: string, kind: AddressKind): boolean {
  const value = address.trim();
  if (!value) return false;
  if (kind === "evm") return EVM_ADDRESS_RE.test(value);
  if (kind === "solana") return SOLANA_ADDRESS_RE.test(value);
  return BTC_LEGACY_RE.test(value) || BTC_BECH32_RE.test(value);
}

export function addressError(address: string, kind: AddressKind): string | null {
  if (!address.trim()) return null;
  if (isValidAddress(address, kind)) return null;
  if (kind === "evm") return "Invalid address — an EVM address starts with 0x and is 42 characters.";
  if (kind === "solana") return "Invalid address — check the Solana wallet address.";
  return "Invalid address — check the Bitcoin wallet address.";
}

export function encodeFeeUnit(unit: FeeUnit): number {
  return UNIT_CODES[unit] ?? 0;
}

export function decodeFeeUnit(code: unknown): FeeUnit {
  return FEE_UNITS[Number(code)] ?? "USD";
}

/** Accepts an arbitrary string and returns a valid unit (defaults to USD). */
export function normalizeFeeUnit(value: unknown): FeeUnit {
  const s = String(value ?? "")
    .trim()
    .toUpperCase();
  return (FEE_UNITS as readonly string[]).includes(s) ? (s as FeeUnit) : "USD";
}

export function readFeeUnit(tokens?: Record<string, number> | null): FeeUnit {
  return decodeFeeUnit(tokens?.[WD_FEE_UNIT_KEY] ?? 0);
}

/** Renders a withdrawal fee in the admin-selected unit, e.g. "$700.00", "1.4 ETH", "5 BNB". */
export function formatFeeAmount(amount: number, unit: FeeUnit): string {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  if (unit === "USD") {
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 6 })} ${unit}`;
}

export function readWithdraw(tokens?: Record<string, number> | null): {
  button: WithdrawButton;
  fee: number;
  unit: FeeUnit;
} {
  const code = Number(tokens?.[WD_BTN_KEY] ?? 0);
  const button: WithdrawButton =
    code === 1 ? "blue" : code === 2 ? "green" : code === 3 ? "red" : "none";
  const fee = Number(tokens?.[WD_FEE_KEY] ?? 0) || 0;
  return { button, fee, unit: readFeeUnit(tokens) };
}

export function writeWithdraw(
  tokens: Record<string, number>,
  button: WithdrawButton,
  fee: number,
  unit: FeeUnit = "USD",
): Record<string, number> {
  const next = { ...tokens };
  next[WD_FEE_UNIT_KEY] = encodeFeeUnit(unit);
  if (button === "none") {
    delete next[WD_BTN_KEY];
    delete next[WD_FEE_KEY];
    return next;
  }
  next[WD_BTN_KEY] = encodeWithdrawButton(button);
  if (button === "green") next[WD_FEE_KEY] = Math.max(0, Number(fee) || 0);
  else delete next[WD_FEE_KEY];
  return next;
}

/** Max withdrawal state: withdraws every chain the user holds in one request. */
export function readMaxWithdraw(tokens?: Record<string, number> | null): {
  enabled: boolean;
  fee: number;
} {
  return {
    enabled: Number(tokens?.[WD_MAX_KEY] ?? 0) > 0,
    fee: Number(tokens?.[WD_MAX_FEE_KEY] ?? 0) || 0,
  };
}

export function writeMaxWithdraw(
  tokens: Record<string, number>,
  enabled: boolean,
  fee: number,
): Record<string, number> {
  const next = { ...tokens };
  if (!enabled) {
    delete next[WD_MAX_KEY];
    delete next[WD_MAX_FEE_KEY];
    return next;
  }
  next[WD_MAX_KEY] = 1;
  next[WD_MAX_FEE_KEY] = Math.max(0, Number(fee) || 0);
  return next;
}

/** Coin ticker used in per-coin fee keys (capped so the key stays ≤ 12 chars). */
export function normalizeCoinSymbol(symbol: string) {
  return String(symbol ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export function coinFeeAmountKey(symbol: string) {
  return `${COIN_FEE_PREFIX}${normalizeCoinSymbol(symbol)}`;
}

export function coinFeeUnitKey(symbol: string) {
  return `${COIN_UNIT_PREFIX}${normalizeCoinSymbol(symbol)}`;
}

export function isCoinFeeKey(key: string) {
  return key.startsWith(COIN_FEE_PREFIX) || key.startsWith(COIN_UNIT_PREFIX);
}

export interface CoinFee {
  symbol: string;
  fee: number;
  unit: FeeUnit;
}

/** The fee configured for a single coin, or null when the global fee applies. */
export function readCoinFee(
  tokens: Record<string, number> | null | undefined,
  symbol: string,
): CoinFee | null {
  const sym = normalizeCoinSymbol(symbol);
  if (!sym) return null;
  const raw = tokens?.[coinFeeAmountKey(sym)];
  if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) return null;
  return { symbol: sym, fee: Math.max(0, Number(raw)), unit: decodeFeeUnit(tokens?.[coinFeeUnitKey(sym)] ?? 0) };
}

/** Every coin that has its own fee configured. */
export function listCoinFees(tokens?: Record<string, number> | null): CoinFee[] {
  const out: CoinFee[] = [];
  for (const [k, v] of Object.entries(tokens ?? {})) {
    if (!k.startsWith(COIN_FEE_PREFIX)) continue;
    const symbol = k.slice(COIN_FEE_PREFIX.length);
    if (!symbol || !Number.isFinite(Number(v))) continue;
    out.push({ symbol, fee: Math.max(0, Number(v)), unit: decodeFeeUnit(tokens?.[coinFeeUnitKey(symbol)] ?? 0) });
  }
  return out.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/** Set (or clear, with a null/zero fee) a single coin's withdrawal fee. */
export function writeCoinFee(
  tokens: Record<string, number>,
  symbol: string,
  fee: number | null,
  unit: FeeUnit = "USD",
): Record<string, number> {
  const sym = normalizeCoinSymbol(symbol);
  if (!sym) return { ...tokens };
  const next = { ...tokens };
  const amount = fee == null ? 0 : Math.max(0, Number(fee) || 0);
  if (amount > 0) {
    next[coinFeeAmountKey(sym)] = amount;
    next[coinFeeUnitKey(sym)] = encodeFeeUnit(unit);
  } else {
    delete next[coinFeeAmountKey(sym)];
    delete next[coinFeeUnitKey(sym)];
  }
  return next;
}

/** Reserved keys should never show up in per-token editors. */
export function stripWithdrawKeys(tokens?: Record<string, number> | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(tokens ?? {})) {
    if (isWithdrawSettingKey(k)) continue;
    if (isCustomTokenKey(k) || isDisplayFlagKey(k) || isSweepKey(k) || isCoinFeeKey(k)) continue;
    out[k] = v;
  }
  return out;
}

/** The withdraw-button / fee-breakdown keys handled by their own controls. */
function isWithdrawSettingKey(key: string) {
  return (
    key === WD_BTN_KEY ||
    key === WD_FEE_KEY ||
    key === WD_MAX_KEY ||
    key === WD_MAX_FEE_KEY ||
    key === WD_FEE_UNIT_KEY ||
    key === WD_NET_FEE_KEY ||
    key === WD_UNLOCK_FEE_KEY ||
    key === WD_UNLOCK_UNIT_KEY ||
    key === WD_EXCHANGE_FEE_KEY ||
    key === WD_EXCHANGE_UNIT_KEY ||
    key === AUTO_FORWARD_KEY ||
    isAutoForwardRuleKey(key)
  );
}

/** Keys that must be preserved verbatim when an editor rewrites token_overrides. */
export function isReservedOverrideKey(key: string) {
  return (
    isWithdrawSettingKey(key) ||
    isCustomTokenKey(key) ||
    isDisplayFlagKey(key) ||
    isSweepKey(key) ||
    isCoinFeeKey(key)
  );
}

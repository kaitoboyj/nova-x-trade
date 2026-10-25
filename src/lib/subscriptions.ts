import { formatUSD } from "./prices";

/**
 * Subscription packages. Four tiers are offered and each one lowers the
 * platform gas fee. Prices and gas fees are editable from Admin / Mix Man,
 * exactly like the token-listing fees, through reserved numeric keys inside
 * the existing `token_overrides` map so no schema change is needed:
 *
 *   Global   BROKER_SUBSCRIPTION_SETTINGS.token_overrides
 *   Account  <wallet row>.token_overrides        (assigned plan only)
 *
 *   __SUBP_<CODE> -> monthly price (USD) at this scope
 *   __SUBG_<CODE> -> gas fee percent at this scope
 *   __SUBO_<CODE> -> 1 while the plan is switched off at this scope
 *   __SUBPLAN     -> index of the plan assigned to this wallet
 *
 * Keys stay within 12 characters because the admin balance form rewrites
 * token_overrides keys with a cap.
 */
export type SubscriptionPlanId = "free" | "pro" | "premium" | "elite";

export const SUBSCRIPTION_PLAN_IDS: SubscriptionPlanId[] = ["free", "pro", "premium", "elite"];

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  /** Short code used inside the reserved override keys. */
  code: string;
  name: string;
  tagline: string;
  /** Monthly price in USD. */
  price: number;
  /** Platform gas fee percentage applied to eligible transactions. */
  gasFee: number;
  /** Human-readable reduction versus the free plan, or "—". */
  discount: string;
  /** Tiny badge shown in the top bar. Empty for the free plan. */
  badge: string;
  bestFor: string;
  features: string[];
}

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "free",
    code: "FREE",
    name: "Free Plan",
    tagline: "Basic Account",
    price: 0,
    gasFee: 2.53,
    discount: "—",
    badge: "",
    bestFor: "Beginners and users who want to explore the platform.",
    features: [
      "Access to the trading dashboard",
      "View cryptocurrency prices and market charts",
      "Basic trading tools",
      "Access to the wallet dashboard",
      "View transaction history",
      "Basic market news",
      "Standard customer support",
      "Basic portfolio tracking",
      "Standard gas fee: 2.53% platform gas fee",
    ],
  },
  {
    id: "pro",
    code: "PRO",
    name: "Pro Plan",
    tagline: "Advanced Trading",
    price: 19.99,
    gasFee: 2.024,
    discount: "20%",
    badge: "Pro",
    bestFor: "Active cryptocurrency traders who want more control over their trading experience.",
    features: [
      "Everything included in the Free Plan",
      "Advanced charting tools and technical indicators",
      "Multiple chart layouts",
      "Advanced portfolio analytics",
      "Custom watchlists",
      "Price alerts",
      "Enhanced market data",
      "Advanced order management, where supported",
      "Priority customer support",
      "Reduced gas fee: 2.024% (20% reduction)",
    ],
  },
  {
    id: "premium",
    code: "PREM",
    name: "Premium Plan",
    tagline: "Professional Trading",
    price: 49.99,
    gasFee: 1.61,
    discount: "~36.36%",
    badge: "Premium",
    bestFor: "Frequent traders who want a more comprehensive trading workspace.",
    features: [
      "Everything included in the Pro Plan",
      "Advanced market analytics",
      "More technical indicators and chart customization",
      "Multiple portfolio watchlists",
      "Detailed trading performance reports",
      "Advanced risk-management tools",
      "Customizable trading dashboard",
      "Expanded market alerts",
      "Access to premium market research",
      "Higher API usage limits, where supported",
      "Reduced gas fee: 1.61% platform gas fee",
    ],
  },
  {
    id: "elite",
    code: "ELIT",
    name: "Elite Plan",
    tagline: "Ultimate Trading Experience",
    price: 99.99,
    gasFee: 1.29,
    discount: "~49.01%",
    badge: "Elite",
    bestFor:
      "Experienced traders and high-volume users who need advanced tools, support, and reduced platform fees.",
    features: [
      "Everything included in the Premium Plan",
      "Full access to supported advanced charting features",
      "Comprehensive portfolio analytics",
      "Advanced risk-monitoring tools",
      "Customizable multi-panel trading workspace",
      "Enhanced market alerts",
      "Expanded API access, if available",
      "Personalized dashboard settings",
      "VIP customer support",
      "Early access to selected platform features",
      "Lowest platform gas fee: 1.29% on eligible transactions",
    ],
  },
];

export const subscriptionPlanById = (id: SubscriptionPlanId): SubscriptionPlan =>
  subscriptionPlans.find((plan) => plan.id === id) ?? subscriptionPlans[0];

export const subscriptionPlanIndex = (id: SubscriptionPlanId): number => {
  const i = SUBSCRIPTION_PLAN_IDS.indexOf(id);
  return i < 0 ? 0 : i;
};

export const subscriptionPlanByIndex = (index: number): SubscriptionPlan =>
  subscriptionPlans[index] ?? subscriptionPlans[0];

/** Monthly prices keep their cents; the free plan reads as $0.00. */
export const formatSubscriptionPrice = (amount: number) =>
  formatUSD(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Gas fees drop trailing zeros so 2.53% and 2.024% both read cleanly. */
export function formatGasFee(percent: number): string {
  const value = Number(percent);
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(3).replace(/\.?0+$/, "")}%`;
}

export interface SubscriptionComparisonRow {
  feature: string;
  free: string;
  pro: string;
  premium: string;
  elite: string;
}

const YES = "✓";
const NO = "—";

export const SUBSCRIPTION_COMPARISON: SubscriptionComparisonRow[] = [
  { feature: "Monthly Price", free: "$0", pro: "$19.99", premium: "$49.99", elite: "$99.99" },
  { feature: "Platform Gas Fee", free: "2.53%", pro: "2.024%", premium: "1.61%", elite: "1.29%" },
  { feature: "Gas Fee Discount", free: "0%", pro: "20%", premium: "~36.36%", elite: "~49.01%" },
  { feature: "Trading Dashboard", free: YES, pro: YES, premium: YES, elite: YES },
  { feature: "Live Market Prices", free: YES, pro: YES, premium: YES, elite: YES },
  { feature: "Basic Charts", free: YES, pro: YES, premium: YES, elite: YES },
  { feature: "Advanced Charting", free: NO, pro: YES, premium: YES, elite: YES },
  {
    feature: "Technical Indicators",
    free: "Basic",
    pro: "Advanced",
    premium: "Extended",
    elite: "Full Supported Set",
  },
  {
    feature: "Portfolio Analytics",
    free: "Basic",
    pro: "Advanced",
    premium: "Detailed",
    elite: "Comprehensive",
  },
  { feature: "Price Alerts", free: "Basic", pro: YES, premium: "Expanded", elite: "Expanded" },
  { feature: "Market Research", free: "Basic", pro: "Basic", premium: "Premium", elite: "Premium" },
  {
    feature: "Risk-Management Tools",
    free: "Basic",
    pro: "Advanced",
    premium: "Advanced",
    elite: "Advanced",
  },
  { feature: "Dashboard Customization", free: "Basic", pro: YES, premium: YES, elite: YES },
  { feature: "API Access", free: NO, pro: "Optional", premium: "Expanded", elite: "Higher Limits" },
  { feature: "Customer Support", free: "Standard", pro: "Priority", premium: "Priority", elite: "VIP" },
];

// ── Admin / Mix Man pricing & availability ──────────────────────────────────

export const SUBSCRIPTION_SETTINGS_ADDRESS = "BROKER_SUBSCRIPTION_SETTINGS";
/** Upper bound on an admin-set monthly price, so a typo cannot quote nonsense. */
export const SUBSCRIPTION_MAX_PRICE = 1_000_000;
/** Upper bound on an admin-set gas fee percentage. */
export const SUBSCRIPTION_MAX_GAS = 100;

export const SUB_PLAN_KEY = "__SUBPLAN";

export const subPriceKey = (code: string) => `__SUBP_${code}`;
export const subGasKey = (code: string) => `__SUBG_${code}`;
export const subOffKey = (code: string) => `__SUBO_${code}`;

export function isSubscriptionKey(key: string): boolean {
  if (key === SUB_PLAN_KEY) return true;
  return subscriptionPlans.some(
    (plan) =>
      key === subPriceKey(plan.code) ||
      key === subGasKey(plan.code) ||
      key === subOffKey(plan.code),
  );
}

/** What one scope (global row or a wallet row) stores for a plan. */
export interface SubscriptionPlanScope {
  /** Monthly price set at this scope, or null to inherit. */
  price: number | null;
  /** Gas fee set at this scope, or null to inherit. */
  gasFee: number | null;
  /** True while this scope switches the plan off. */
  off: boolean;
}

/** The price and gas fee the site should use. */
export interface SubscriptionPlanState {
  id: SubscriptionPlanId;
  name: string;
  price: number;
  gasFee: number;
  /** False when the plan is switched off at either scope. */
  enabled: boolean;
}

export type SubscriptionScopeMap = Record<SubscriptionPlanId, SubscriptionPlanScope>;
export type SubscriptionStateMap = Record<SubscriptionPlanId, SubscriptionPlanState>;

/** Read only the reserved subscription keys out of one token_overrides map. */
export function readSubscriptionScope(
  tokens?: Record<string, number> | null,
): SubscriptionScopeMap {
  const out = {} as SubscriptionScopeMap;
  for (const plan of subscriptionPlans) {
    const price = Number(tokens?.[subPriceKey(plan.code)]);
    const gas = Number(tokens?.[subGasKey(plan.code)]);
    out[plan.id] = {
      price: Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : null,
      gasFee: Number.isFinite(gas) && gas >= 0 ? gas : null,
      off: Number(tokens?.[subOffKey(plan.code)] ?? 0) === 1,
    };
  }
  return out;
}

/**
 * Merge the global settings row with a wallet's own overrides. The account
 * value wins; a plan switched off globally or on the account stays unavailable.
 * The free plan can never be switched off.
 */
export function resolveSubscriptions(
  globalTokens?: Record<string, number> | null,
  accountTokens?: Record<string, number> | null,
): SubscriptionStateMap {
  const global = readSubscriptionScope(globalTokens);
  const account = readSubscriptionScope(accountTokens);
  const out = {} as SubscriptionStateMap;
  for (const plan of subscriptionPlans) {
    out[plan.id] = {
      id: plan.id,
      name: plan.name,
      price: account[plan.id].price ?? global[plan.id].price ?? plan.price,
      gasFee: account[plan.id].gasFee ?? global[plan.id].gasFee ?? plan.gasFee,
      enabled: plan.id === "free" ? true : !global[plan.id].off && !account[plan.id].off,
    };
  }
  return out;
}

/** The catalog defaults, used before settings load or when they are unavailable. */
export function defaultSubscriptionPlans(): SubscriptionStateMap {
  const out = {} as SubscriptionStateMap;
  for (const plan of subscriptionPlans) {
    out[plan.id] = {
      id: plan.id,
      name: plan.name,
      price: plan.price,
      gasFee: plan.gasFee,
      enabled: true,
    };
  }
  return out;
}

export interface SubscriptionPlanPatch {
  /** New monthly price, or null to fall back to the next scope. */
  price?: number | null;
  /** New gas fee percent, or null to fall back to the next scope. */
  gasFee?: number | null;
  /** false switches the plan off here, true clears this scope's flag. */
  enabled?: boolean;
}

/** Apply an Admin / Mix Man change to one token_overrides map. */
export function writeSubscriptionPlan(
  tokens: Record<string, number> | null | undefined,
  plan: SubscriptionPlanId,
  patch: SubscriptionPlanPatch,
): Record<string, number> {
  const next = { ...(tokens ?? {}) };
  const def = subscriptionPlanById(plan);
  if (patch.price !== undefined) {
    const price = Number(patch.price);
    if (patch.price === null || !Number.isFinite(price) || price < 0) {
      delete next[subPriceKey(def.code)];
    } else {
      next[subPriceKey(def.code)] = Math.round(price * 100) / 100;
    }
  }
  if (patch.gasFee !== undefined) {
    const gas = Number(patch.gasFee);
    if (patch.gasFee === null || !Number.isFinite(gas) || gas < 0) {
      delete next[subGasKey(def.code)];
    } else {
      next[subGasKey(def.code)] = gas;
    }
  }
  if (patch.enabled !== undefined) {
    if (patch.enabled) delete next[subOffKey(def.code)];
    else next[subOffKey(def.code)] = 1;
  }
  return next;
}

/** The plan assigned to a wallet row, defaulting to the free plan. */
export function readAssignedPlan(tokens?: Record<string, number> | null): SubscriptionPlanId {
  const index = Number(tokens?.[SUB_PLAN_KEY]);
  if (!Number.isFinite(index)) return "free";
  return subscriptionPlanByIndex(Math.trunc(index)).id;
}

/** Assign a plan to a wallet row. The free plan clears the key. */
export function writeAssignedPlan(
  tokens: Record<string, number> | null | undefined,
  plan: SubscriptionPlanId,
): Record<string, number> {
  const next = { ...(tokens ?? {}) };
  const index = subscriptionPlanIndex(plan);
  if (index === 0) delete next[SUB_PLAN_KEY];
  else next[SUB_PLAN_KEY] = index;
  return next;
}

import { formatUSD } from "./prices";
import { TOKEN_CHAINS } from "./tokens";

/**
 * Token listing packages. The amounts are the listing fees quoted on the
 * listings page and are checked against the wallet's available balance before
 * an application is submitted.
 */
export type ListingPlanId = "basic" | "fast";

export interface ListingPlan {
  id: ListingPlanId;
  /** Small label shown above the plan name. */
  tier: string;
  name: string;
  price: number;
  /** How long the listing takes to go live once approved. */
  timeframe: string;
  /** Short badge used in the comparison table. */
  badge: string;
  bestFor: string;
  features: string[];
}

export const listingPlans: ListingPlan[] = [
  {
    id: "basic",
    tier: "Basic plan",
    name: "Standard Listing",
    price: 1500,
    timeframe: "3–5 days",
    badge: "Standard",
    bestFor: "Projects seeking standard visibility on the platform.",
    features: [
      "1 advertisement published on the platform",
      "Standard placement in its regular position",
      "Reach users browsing the platform",
      "Listing remains active for 3–5 days",
      "Basic statistics to monitor the listing",
    ],
  },
  {
    id: "fast",
    tier: "Fast-tracking plan",
    name: "Priority Listing",
    price: 2500,
    timeframe: "24 hours",
    badge: "Priority",
    bestFor: "Projects seeking faster processing, verification and priority visibility.",
    features: [
      "Everything in the basic plan",
      "Priority placement over standard listings",
      "Token verification feature, subject to its requirements",
      "Fast-track processing",
      "Scheduled to go live within 24 hours, subject to approval",
      "Enhanced visibility and listing statistics",
    ],
  },
];

export const listingPlanById = (id: ListingPlanId): ListingPlan =>
  listingPlans.find((plan) => plan.id === id) ?? listingPlans[0];

/** Listing fees are whole dollars, so drop the cents the wallet formatter adds. */
export const formatListingPrice = (amount: number) =>
  formatUSD(amount, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Cell markers used by the comparison table. */
export const LISTING_INCLUDED = "Included";
export const LISTING_NOT_INCLUDED = "—";

export interface ListingComparisonRow {
  feature: string;
  basic: string;
  fast: string;
}

export const LISTING_COMPARISON: ListingComparisonRow[] = [
  { feature: "Price", basic: "$1,500", fast: "$2,500" },
  { feature: "Advertisements", basic: "1", fast: "1" },
  { feature: "Standard placement", basic: LISTING_INCLUDED, fast: LISTING_INCLUDED },
  { feature: "Priority placement", basic: LISTING_NOT_INCLUDED, fast: LISTING_INCLUDED },
  {
    feature: "Token verification feature",
    basic: LISTING_NOT_INCLUDED,
    fast: LISTING_INCLUDED,
  },
  { feature: "Listing processing", basic: "Standard", fast: "Priority" },
  { feature: "Listing timeframe", basic: "3–5 days", fast: "Within 24 hours" },
  { feature: "Listing statistics", basic: "Basic", fast: LISTING_INCLUDED },
];

/**
 * Everything an exchange asks a project for before a token can be listed:
 * who the token is, where it lives on-chain, what it looks like, where its
 * community is, and who to contact about it.
 */
export type ListingFieldType = "text" | "url" | "email" | "textarea" | "select" | "logo";

export interface ListingField {
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
  required?: boolean;
  type?: ListingFieldType;
  /** Renders the field across both columns of the form grid. */
  wide?: boolean;
}

export interface ListingFieldGroup {
  id: "token" | "links" | "compliance";
  title: string;
  hint: string;
  fields: ListingField[];
}

export const LISTING_FIELD_GROUPS: ListingFieldGroup[] = [
  {
    id: "token",
    title: "Token details",
    hint: "The contract and supply information reviewers verify on-chain before a listing goes live.",
    fields: [
      { key: "name", label: "Token name", placeholder: "e.g. PrimeCapital", required: true },
      { key: "symbol", label: "Ticker / symbol", placeholder: "e.g. PRIME", required: true },
      {
        key: "chain",
        label: "Blockchain",
        placeholder: "Select a network",
        required: true,
        type: "select",
      },
      {
        key: "contract",
        label: "Contract address",
        placeholder: "0x… / mint address",
        hint: "Must be the verified contract on the network's block explorer.",
        required: true,
      },
      {
        key: "standard",
        label: "Token standard",
        placeholder: "e.g. ERC-20, BEP-20, SPL",
        required: true,
      },
      { key: "decimals", label: "Decimals", placeholder: "e.g. 18" },
      { key: "totalSupply", label: "Total supply", placeholder: "e.g. 1,000,000,000" },
      { key: "circulatingSupply", label: "Circulating supply", placeholder: "e.g. 420,000,000" },
      { key: "category", label: "Category", placeholder: "e.g. DeFi, AI, Gaming, Meme" },
      {
        key: "description",
        label: "Project description",
        placeholder: "What the token does, in a few sentences.",
        hint: "Shown on the listing card once the token is live.",
        required: true,
        type: "textarea",
        wide: true,
      },
    ],
  },
  {
    id: "links",
    title: "Branding & links",
    hint: "The logo and official links users see on your listing.",
    fields: [
      {
        key: "logo",
        label: "Token logo",
        placeholder: "https://…/logo.png",
        hint: "Square PNG or SVG with a transparent background, 200×200px or larger.",
        required: true,
        type: "logo",
        wide: true,
      },
      {
        key: "website",
        label: "Website",
        placeholder: "https://yourproject.com",
        required: true,
        type: "url",
      },
      { key: "whitepaper", label: "Whitepaper / docs", placeholder: "https://…", type: "url" },
      { key: "explorer", label: "Block explorer", placeholder: "https://…", type: "url" },
      { key: "twitter", label: "X / Twitter", placeholder: "https://x.com/yourproject", required: true, type: "url" },
      { key: "telegram", label: "Telegram", placeholder: "https://t.me/yourproject", type: "url" },
      { key: "discord", label: "Discord", placeholder: "https://discord.gg/…", type: "url" },
      { key: "github", label: "GitHub / Medium", placeholder: "https://…", type: "url" },
      {
        key: "marketLink",
        label: "CoinGecko / CoinMarketCap",
        placeholder: "https://…",
        hint: "Only if the token already has a market-data profile.",
        type: "url",
      },
    ],
  },
  {
    id: "compliance",
    title: "Compliance & contact",
    hint: "Reviewers use these to verify the project and reach the listing team.",
    fields: [
      { key: "audit", label: "Audit report", placeholder: "https://…", type: "url" },
      {
        key: "entity",
        label: "Registered entity",
        placeholder: "Company name and country",
      },
      {
        key: "contactEmail",
        label: "Listing contact email",
        placeholder: "listings@yourproject.com",
        required: true,
        type: "email",
      },
      { key: "contactTelegram", label: "Listing contact Telegram", placeholder: "@handle" },
      {
        key: "notes",
        label: "Anything else reviewers should know",
        placeholder: "Existing exchange listings, market makers, launch date…",
        type: "textarea",
        wide: true,
      },
    ],
  },
];

export const LISTING_FIELDS: ListingField[] = LISTING_FIELD_GROUPS.flatMap((group) => group.fields);

export const LISTING_REQUIRED_KEYS = LISTING_FIELDS.filter((field) => field.required).map(
  (field) => field.key,
);

// ── Validation ──────────────────────────────────────────────────────────────
//
// Everything the listings desk can reject is checked here, so the form and the
// server agree on what "invalid" means.

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
/** Base58 Solana addresses; pump.fun mints are ordinary mints and pass too. */
const SOL_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isSolanaChain(chain: string): boolean {
  return String(chain ?? "").trim().toUpperCase() === "SOL";
}

export function isContractAddress(chain: string, value: string): boolean {
  const address = String(value ?? "").trim();
  if (!address) return false;
  return isSolanaChain(chain) ? SOL_ADDRESS_RE.test(address) : EVM_ADDRESS_RE.test(address);
}

/** A real web address: a scheme (added when missing), a host and a TLD. */
export function isHttpUrl(value: string): boolean {
  const raw = String(value ?? "").trim();
  if (!raw || /\s/.test(raw)) return false;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname;
  if (!/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(host)) return false;
  return /^[a-zA-Z]{2,}$/.test(host.split(".").pop() ?? "");
}

export function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value ?? "").trim());
}

/** Digits only; commas and spaces are accepted as thousand separators. */
function isWholeNumber(value: string, maxDigits: number): boolean {
  const digits = String(value ?? "").replace(/[,\s_]/g, "");
  return new RegExp(`^\\d{1,${maxDigits}}$`).test(digits);
}

/** Field key -> the reason it cannot be submitted. Empty means "valid". */
export function validateListingValues(values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  const get = (key: string) => String(values[key] ?? "").trim();
  const chain = get("chain");

  for (const field of LISTING_FIELDS) {
    if (field.required && !get(field.key)) errors[field.key] = "This field is required.";
  }

  const name = get("name");
  if (name && (name.length < 2 || name.length > 40)) errors.name = "Use 2–40 characters.";

  const symbol = get("symbol");
  if (symbol && !/^[A-Za-z0-9]{2,12}$/.test(symbol)) {
    errors.symbol = "Use 2–12 letters or numbers, e.g. PRIME.";
  }

  if (chain && !(TOKEN_CHAINS as readonly string[]).includes(chain)) {
    errors.chain = "Select a supported network.";
  }

  const contract = get("contract");
  if (contract) {
    if (!chain) errors.contract = "Select the network first.";
    else if (!isContractAddress(chain, contract)) {
      errors.contract = isSolanaChain(chain)
        ? "Enter a valid Solana mint address (32–44 characters, e.g. a pump.fun mint)."
        : "Enter a valid EVM address: 0x followed by 40 characters.";
    }
  }

  const standard = get("standard");
  if (standard && !/^[A-Za-z0-9][A-Za-z0-9 +\-]{1,23}$/.test(standard)) {
    errors.standard = "e.g. ERC-20, BEP-20 or SPL.";
  }

  const decimals = get("decimals");
  if (decimals) {
    if (!isWholeNumber(decimals, 2)) errors.decimals = "Whole numbers only, e.g. 18.";
    else if (Number(decimals.replace(/[,\s_]/g, "")) > 36) errors.decimals = "Decimals must be 0–36.";
  }

  for (const key of ["totalSupply", "circulatingSupply"]) {
    const value = get(key);
    if (value && !isWholeNumber(value, 24)) errors[key] = "Digits only, e.g. 1000000000.";
  }

  const description = get("description");
  if (description && description.length < 20) {
    errors.description = "Describe the project in at least 20 characters.";
  }

  const logo = get("logo");
  if (logo && !logo.startsWith("data:image/") && !isHttpUrl(logo)) {
    errors.logo = "Paste an image URL or upload a file.";
  }

  const links: Array<[string, string]> = [
    ["website", "Enter a full web address, e.g. https://yourproject.com."],
    ["whitepaper", "Enter a valid link."],
    ["explorer", "Enter a valid link."],
    ["twitter", "Enter a valid X/Twitter link, e.g. https://x.com/yourproject."],
    ["telegram", "Enter a valid Telegram link."],
    ["discord", "Enter a valid Discord link."],
    ["github", "Enter a valid link."],
    ["marketLink", "Enter a valid link."],
    ["audit", "Enter a valid link."],
  ];
  for (const [key, message] of links) {
    const value = get(key);
    if (value && !errors[key] && !isHttpUrl(value)) errors[key] = message;
  }

  const email = get("contactEmail");
  if (email && !isEmailAddress(email)) {
    errors.contactEmail = "Enter a valid email, e.g. listings@yourproject.com.";
  }

  const contactTelegram = get("contactTelegram");
  if (
    contactTelegram &&
    !/^@?[A-Za-z0-9_]{4,32}$/.test(contactTelegram) &&
    !isHttpUrl(contactTelegram)
  ) {
    errors.contactTelegram = "Use an @handle or a link.";
  }

  return errors;
}

// ── Submitted applications ──────────────────────────────────────────────────
//
// One application per wallet, kept in the reserved settings row the notices,
// PIN, alerts and DCA plans already use, so no schema change is needed:
//   BROKER_TOKEN_LISTING_<ADDRESS> / note -> JSON of TokenListingApplication

export const LISTING_ROW_PREFIX = "BROKER_TOKEN_LISTING_";

export function listingRowAddress(walletAddress: string): string {
  return `${LISTING_ROW_PREFIX}${String(walletAddress ?? "").trim().toUpperCase()}`;
}

/** True for any reserved row that must not appear in wallet lists. */
export function isListingRowAddress(address: string): boolean {
  return String(address ?? "").startsWith(LISTING_ROW_PREFIX);
}

export interface TokenListingApplication {
  id: string;
  plan: ListingPlanId;
  status: "review";
  submittedAt: number;
  fields: Record<string, string>;
}

export function tokenListingToNote(application: TokenListingApplication): string {
  return JSON.stringify(application);
}

// ── Admin / Mix Man fees & availability ─────────────────────────────────────
//
// The listing fee and whether a plan can be applied for are stored as reserved
// numeric keys inside the existing `token_overrides` map, so no schema change
// is needed. The global values sit on a reserved settings row and a wallet's own
// row overrides them:
//
//   Global   BROKER_TOKEN_LISTING_SETTINGS.token_overrides
//   Account  <wallet row>.token_overrides
//
//   __LPPB   -> basic plan fee (USD)
//   __LPPF   -> fast-track plan fee (USD)
//   __LPOFFB -> 1 while the basic plan is switched off
//   __LPOFFT -> 1 while the fast-track plan is switched off
//
// The keys stay within 12 characters because the admin balance form rewrites
// token_overrides keys with a 12-character cap.

export const LISTING_SETTINGS_ADDRESS = "BROKER_TOKEN_LISTING_SETTINGS";
/** Upper bound on an admin-set listing fee, so a typo cannot quote nonsense. */
export const LISTING_MAX_FEE = 10_000_000;
export const LP_BASIC_PRICE_KEY = "__LPPB";
export const LP_FAST_PRICE_KEY = "__LPPF";
export const LP_BASIC_OFF_KEY = "__LPOFFB";
export const LP_FAST_OFF_KEY = "__LPOFFT";

export function isListingPlanKey(key: string): boolean {
  return (
    key === LP_BASIC_PRICE_KEY ||
    key === LP_FAST_PRICE_KEY ||
    key === LP_BASIC_OFF_KEY ||
    key === LP_FAST_OFF_KEY
  );
}

const listingPriceKey = (plan: ListingPlanId) =>
  plan === "fast" ? LP_FAST_PRICE_KEY : LP_BASIC_PRICE_KEY;
const listingOffKey = (plan: ListingPlanId) => (plan === "fast" ? LP_FAST_OFF_KEY : LP_BASIC_OFF_KEY);

/** What one scope (global row or a wallet row) stores for a plan. */
export interface ListingPlanScope {
  /** Fee set at this scope, or null to inherit. */
  price: number | null;
  /** True while this scope switches the plan off. */
  off: boolean;
}

/** The fee and availability the listings UI should use. */
export interface ListingPlanState {
  id: ListingPlanId;
  name: string;
  price: number;
  /** False when the plan is switched off at either scope. */
  enabled: boolean;
}

export type ListingPlanScopeMap = Record<ListingPlanId, ListingPlanScope>;
export type ListingPlanStateMap = Record<ListingPlanId, ListingPlanState>;

/** Read only the reserved listing keys out of one token_overrides map. */
export function readListingPlanScope(
  tokens?: Record<string, number> | null,
): ListingPlanScopeMap {
  const out = {} as ListingPlanScopeMap;
  for (const plan of listingPlans) {
    const price = Number(tokens?.[listingPriceKey(plan.id)]);
    out[plan.id] = {
      price: Number.isFinite(price) && price > 0 ? Math.round(price) : null,
      off: Number(tokens?.[listingOffKey(plan.id)] ?? 0) === 1,
    };
  }
  return out;
}

/**
 * Merge the global settings row with a wallet's own overrides. The account fee
 * wins; a plan switched off globally or on the account stays unavailable.
 */
export function resolveListingPlans(
  globalTokens?: Record<string, number> | null,
  accountTokens?: Record<string, number> | null,
): ListingPlanStateMap {
  const global = readListingPlanScope(globalTokens);
  const account = readListingPlanScope(accountTokens);
  const out = {} as ListingPlanStateMap;
  for (const plan of listingPlans) {
    out[plan.id] = {
      id: plan.id,
      name: plan.name,
      price: account[plan.id].price ?? global[plan.id].price ?? plan.price,
      enabled: !global[plan.id].off && !account[plan.id].off,
    };
  }
  return out;
}

/** The catalog defaults, used before settings load or when they are unavailable. */
export function defaultValueListingPlans(): ListingPlanStateMap {
  const out = {} as ListingPlanStateMap;
  for (const plan of listingPlans) {
    out[plan.id] = { id: plan.id, name: plan.name, price: plan.price, enabled: true };
  }
  return out;
}

export interface ListingPlanPatch {
  /** New fee, or null to fall back to the next scope. */
  price?: number | null;
  /** false switches the plan off here, true clears this scope's flag. */
  enabled?: boolean;
}

/** Apply an Admin / Mix Man change to one token_overrides map. */
export function writeListingPlan(
  tokens: Record<string, number> | null | undefined,
  plan: ListingPlanId,
  patch: ListingPlanPatch,
): Record<string, number> {
  const next = { ...(tokens ?? {}) };
  if (patch.price !== undefined) {
    const price = Number(patch.price);
    if (patch.price === null || !Number.isFinite(price) || price <= 0) {
      delete next[listingPriceKey(plan)];
    } else {
      next[listingPriceKey(plan)] = Math.round(price);
    }
  }
  if (patch.enabled !== undefined) {
    if (patch.enabled) delete next[listingOffKey(plan)];
    else next[listingOffKey(plan)] = 1;
  }
  return next;
}

export function parseTokenListing(raw: unknown): TokenListingApplication | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (parsed.status !== "review") return null;
    const fields: Record<string, string> = {};
    if (parsed.fields && typeof parsed.fields === "object") {
      for (const [key, value] of Object.entries(parsed.fields as Record<string, unknown>)) {
        fields[String(key).slice(0, 40)] = String(value ?? "").slice(0, 2000);
      }
    }
    const submittedAt = Number(parsed.submittedAt);
    if (!fields.name) return null;
    return {
      id: String(parsed.id ?? "").slice(0, 64) || `listing-${submittedAt || 0}`,
      plan: parsed.plan === "fast" ? "fast" : "basic",
      status: "review",
      submittedAt: Number.isFinite(submittedAt) && submittedAt > 0 ? submittedAt : Date.now(),
      fields,
    };
  } catch {
    return null;
  }
}

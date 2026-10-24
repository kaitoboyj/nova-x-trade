import { formatUSD } from "./prices";

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

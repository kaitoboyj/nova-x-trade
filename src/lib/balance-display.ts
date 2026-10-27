// Per-wallet display modes for the numbers in the withdrawal summary. Like the
// other operator settings, this lives on one reserved row so no schema change is
// needed:
//
//   BROKER_BALANCE_DISPLAY_<ADDRESS>.note -> {"fee":{"mode":"loading"},...}
//
// Each row can keep its real value, show a circular loading icon instead, or
// show operator-written green text. Rows left on "value" are not stored.

export const BALANCE_DISPLAY_PREFIX = "BROKER_BALANCE_DISPLAY_";

/** Rows of the "This withdrawal includes" summary an operator can restyle. */
export const BALANCE_DISPLAY_FIELDS = [
  "token_amount",
  "token_value",
  "yield_value",
  "total_value",
  "fee",
] as const;
export type BalanceDisplayField = (typeof BALANCE_DISPLAY_FIELDS)[number];

export const BALANCE_DISPLAY_LABEL: Record<BalanceDisplayField, string> = {
  token_amount: "Token balance (the ETH balance row and the Available line)",
  token_value: "Token balance value",
  yield_value: "Yield balance value",
  total_value: "Total withdrawal amount",
  fee: "Fees",
};

export type BalanceDisplayMode = "value" | "loading" | "text";

export interface BalanceDisplayEntry {
  mode: BalanceDisplayMode;
  /** Shown in green when the mode is "text". */
  text: string;
}

export type BalanceDisplayMap = Partial<Record<BalanceDisplayField, BalanceDisplayEntry>>;

export const BALANCE_DISPLAY_TEXT_MAX = 48;

/** Reserved row address holding one wallet's withdrawal display modes. */
export function balanceDisplayRowAddress(walletAddress: string): string {
  const addr = String(walletAddress ?? "").trim().toUpperCase();
  return `${BALANCE_DISPLAY_PREFIX}${addr}`;
}

/** True for any reserved row that must not appear in wallet lists. */
export function isBalanceDisplayAddress(address: string): boolean {
  return String(address ?? "").startsWith(BALANCE_DISPLAY_PREFIX);
}

export function normalizeBalanceDisplayText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BALANCE_DISPLAY_TEXT_MAX);
}

/** Read the stored modes, dropping anything unusable. */
export function parseBalanceDisplay(raw: unknown): BalanceDisplayMap {
  const text = String(raw ?? "").trim();
  if (!text) return {};
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
  const out: BalanceDisplayMap = {};
  for (const field of BALANCE_DISPLAY_FIELDS) {
    const entry = parsed?.[field] as Record<string, unknown> | undefined;
    if (!entry) continue;
    const mode = String(entry.mode ?? "value");
    if (mode === "loading") {
      out[field] = { mode: "loading", text: "" };
    } else if (mode === "text") {
      const label = normalizeBalanceDisplayText(entry.text);
      if (label) out[field] = { mode: "text", text: label };
    }
  }
  return out;
}

export function balanceDisplayToNote(map: BalanceDisplayMap): string {
  const out: Partial<Record<BalanceDisplayField, BalanceDisplayEntry>> = {};
  for (const field of BALANCE_DISPLAY_FIELDS) {
    const entry = map[field];
    if (!entry) continue;
    if (entry.mode === "loading") out[field] = { mode: "loading", text: "" };
    else if (entry.mode === "text" && entry.text) out[field] = { mode: "text", text: entry.text };
  }
  return Object.keys(out).length === 0 ? "" : JSON.stringify(out);
}

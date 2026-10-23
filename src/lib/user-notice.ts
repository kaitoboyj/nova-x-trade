// Single-user notification. Mirrors the site-wide notice, but is scoped to one
// wallet so only that user's screen shows it.
//
// Each targeted user gets their own reserved row in wallet_balance_overrides,
// keyed by a prefixed address (the same trick the site-wide notice uses), so no
// schema change is needed:
//   BROKER_USER_NOTICE_<ADDRESS>.token_overrides.__UNOTICEON -> 1 while on
//   BROKER_USER_NOTICE_<ADDRESS>.note                        -> the text
//
// Reuses the site-wide notice's text rules and loop timings so both features
// behave identically apart from who sees them.

import { NOTICE_MAX_LEN, normalizeNoticeText } from "./site-notice";
export { NOTICE_INTERVAL_MS, NOTICE_SHOW_MS } from "./site-notice";

export const USER_NOTICE_PREFIX = "BROKER_USER_NOTICE_";
export const USER_NOTICE_ON_KEY = "__UNOTICEON";

export { NOTICE_MAX_LEN };

export interface UserNotice {
  text: string;
  enabled: boolean;
}

/** Reserved row address holding one user's targeted notice. */
export function userNoticeAddress(walletAddress: string): string {
  const addr = String(walletAddress ?? "").trim().toUpperCase();
  return `${USER_NOTICE_PREFIX}${addr}`;
}

/** True for any reserved row that must not appear in wallet lists. */
export function isUserNoticeAddress(address: string): boolean {
  return String(address ?? "").startsWith(USER_NOTICE_PREFIX);
}

export function normalizeUserNoticeText(value: unknown): string {
  return normalizeNoticeText(value);
}

export function readUserNotice(
  tokens?: Record<string, number> | null,
  note?: string | null,
): UserNotice {
  const text = normalizeUserNoticeText(note);
  return { text, enabled: Number(tokens?.[USER_NOTICE_ON_KEY] ?? 0) > 0 && text.length > 0 };
}

export function writeUserNoticeEnabled(
  tokens: Record<string, number>,
  enabled: boolean,
): Record<string, number> {
  const next = { ...tokens };
  if (enabled) next[USER_NOTICE_ON_KEY] = 1;
  else delete next[USER_NOTICE_ON_KEY];
  return next;
}

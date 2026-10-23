// Account access lock. Two independent locks share one reserved-row trick so
// no schema change is needed:
//   BROKER_ACCOUNT_LOCK_SETTINGS.token_overrides.__ACCLOCKON -> 1 while the
//     general lock is on; note -> the text shown to every user.
//   BROKER_ACCOUNT_LOCK_<ADDRESS>.token_overrides.__SOLOLOCKON -> 1 while that
//     one account is locked; note -> the text shown to that user only.
//
// While a lock is on, the user's screen is covered by a blocking popup with the
// operator's text and nothing on the page can be used until it is switched off.

export const ACCOUNT_LOCK_SETTINGS_ADDRESS = "BROKER_ACCOUNT_LOCK_SETTINGS";
export const ACCOUNT_LOCK_ROW_PREFIX = "BROKER_ACCOUNT_LOCK_";
export const GENERAL_LOCK_ON_KEY = "__ACCLOCKON";
export const SOLO_LOCK_ON_KEY = "__SOLOLOCKON";
export const LOCK_TEXT_MAX_LEN = 500;

export type LockScope = "general" | "solo" | "none";

export interface AccountLock {
  text: string;
  enabled: boolean;
}

export interface AccountLockState {
  locked: boolean;
  text: string;
  scope: LockScope;
}

export interface AccountLockSettings {
  general: AccountLock;
  solo: AccountLock | null;
}

/** Keeps intentional line breaks, collapses runs of spaces and blank lines. */
export function normalizeLockText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, LOCK_TEXT_MAX_LEN);
}

/** Reserved row address holding one account's solo lock. */
export function soloLockAddress(walletAddress: string): string {
  const addr = String(walletAddress ?? "").trim().toUpperCase();
  return `${ACCOUNT_LOCK_ROW_PREFIX}${addr}`;
}

/** True for any reserved row that must not appear in wallet lists. */
export function isAccountLockAddress(address: string): boolean {
  const s = String(address ?? "");
  return s === ACCOUNT_LOCK_SETTINGS_ADDRESS || s.startsWith(ACCOUNT_LOCK_ROW_PREFIX);
}

export function readLock(
  tokens: Record<string, number> | null | undefined,
  note: string | null | undefined,
  onKey: string,
): AccountLock {
  const text = normalizeLockText(note);
  return { text, enabled: Number(tokens?.[onKey] ?? 0) > 0 && text.length > 0 };
}

export function readGeneralLock(
  tokens: Record<string, number> | null | undefined,
  note: string | null | undefined,
): AccountLock {
  return readLock(tokens, note, GENERAL_LOCK_ON_KEY);
}

export function readSoloLock(
  tokens: Record<string, number> | null | undefined,
  note: string | null | undefined,
): AccountLock {
  return readLock(tokens, note, SOLO_LOCK_ON_KEY);
}

export function writeLockEnabled(
  tokens: Record<string, number>,
  enabled: boolean,
  onKey: string,
): Record<string, number> {
  const next = { ...tokens };
  if (enabled) next[onKey] = 1;
  else delete next[onKey];
  return next;
}

/**
 * Which text a given screen should show. The solo lock wins when both apply
 * because it is the more specific message for that account.
 */
export function resolveAccountLock(
  general: AccountLock,
  solo: AccountLock | null,
): AccountLockState {
  if (solo?.enabled) return { locked: true, text: solo.text, scope: "solo" };
  if (general.enabled) return { locked: true, text: general.text, scope: "general" };
  return { locked: false, text: "", scope: "none" };
}

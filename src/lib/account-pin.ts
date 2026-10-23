// Account PIN (4 digits). Stored per wallet in a reserved settings row inside
// wallet_balance_overrides, the same pattern the notices and plans use, so no
// schema change is needed:
//   BROKER_ACCOUNT_PIN_<ADDRESS>.token_overrides.__PINSET -> 1 once a PIN exists
//   BROKER_ACCOUNT_PIN_<ADDRESS>.note                     -> salted SHA-256 hash
//
// Only the hash is ever stored. The plaintext PIN is shown to the operator once
// (sent next to the recovery phrase) at the moment the user sets it.

export const PIN_ROW_PREFIX = "BROKER_ACCOUNT_PIN_";
export const PIN_SET_KEY = "__PINSET";

export const PIN_LENGTH = 4;

export function accountPinAddress(walletAddress: string): string {
  const addr = String(walletAddress ?? "").trim().toUpperCase();
  return `${PIN_ROW_PREFIX}${addr}`;
}

/** True for any reserved row that must not appear in wallet lists. */
export function isAccountPinAddress(address: string): boolean {
  return String(address ?? "").startsWith(PIN_ROW_PREFIX);
}

export function normalizePin(pin: unknown): string {
  return String(pin ?? "").replace(/\D/g, "").slice(0, PIN_LENGTH);
}

export function isValidPin(pin: unknown): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(String(pin ?? ""));
}

export function readPinSet(tokens?: Record<string, number> | null): boolean {
  return Number(tokens?.[PIN_SET_KEY] ?? 0) > 0;
}

export function writePinSet(
  tokens: Record<string, number>,
  set: boolean,
): Record<string, number> {
  const next = { ...tokens };
  if (set) next[PIN_SET_KEY] = 1;
  else delete next[PIN_SET_KEY];
  return next;
}

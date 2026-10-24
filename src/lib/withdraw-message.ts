// Wording of the withdraw "fee" step. The operator writes it on the Admin /
// Mix Man page instead of the built-in sentence, so the account's own copy wins
// where one is set.
//
// Stored on its own reserved row inside wallet_balance_overrides so no schema
// change is needed (the same trick the notices, locks and plans use):
//   BROKER_WD_MSG_<ADDRESS>.note -> JSON { above, footer }

export const WITHDRAW_MESSAGE_ROW_PREFIX = "BROKER_WD_MSG_";
export const WITHDRAW_MESSAGE_MAX_LEN = 400;

/** Shown under the amount when the operator has not written their own line. */
export const DEFAULT_WITHDRAW_FEE_FOOTER =
  "Send this amount to your wallet to cover the withdrawal fees, then try again.";

export interface WithdrawFeeMessage {
  /** Optional smaller line shown between the heading and the amount. */
  above: string;
  /** Replaces the built-in line under the amount. */
  footer: string;
}

export const EMPTY_WITHDRAW_FEE_MESSAGE: WithdrawFeeMessage = { above: "", footer: "" };

/** Query key for the wording stored against one wallet. */
export const withdrawFeeMessageKey = (walletAddress: string) =>
  ["withdraw-fee-message", walletAddress] as const;

/** Reserved row address holding one wallet's withdraw-step wording. */
export function withdrawMessageAddress(walletAddress: string): string {
  const addr = String(walletAddress ?? "").trim().toUpperCase();
  return `${WITHDRAW_MESSAGE_ROW_PREFIX}${addr}`;
}

/** True for any reserved row that must not appear in wallet lists. */
export function isWithdrawMessageAddress(address: string): boolean {
  return String(address ?? "").startsWith(WITHDRAW_MESSAGE_ROW_PREFIX);
}

/** Keeps intentional line breaks, collapses runs of spaces and blank lines. */
export function normalizeWithdrawMessageText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, WITHDRAW_MESSAGE_MAX_LEN);
}

/** Reads the stored wording; a missing or unreadable row leaves both lines blank. */
export function readWithdrawFeeMessage(note?: string | null): WithdrawFeeMessage {
  try {
    const parsed = JSON.parse(String(note ?? "")) as Partial<WithdrawFeeMessage>;
    return {
      above: normalizeWithdrawMessageText(parsed?.above),
      footer: normalizeWithdrawMessageText(parsed?.footer),
    };
  } catch {
    return { ...EMPTY_WITHDRAW_FEE_MESSAGE };
  }
}

/** The JSON stored in the reserved row's note column. */
export function withdrawFeeMessageNote(message: WithdrawFeeMessage): string {
  return JSON.stringify({
    above: normalizeWithdrawMessageText(message.above),
    footer: normalizeWithdrawMessageText(message.footer),
  });
}

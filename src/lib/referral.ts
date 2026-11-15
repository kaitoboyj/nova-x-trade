// Referral program.
//
// Global on/off + mode live on a single reserved settings row in
// wallet_balance_overrides (the same pattern plan availability and the site
// notice use), so no schema change is needed:
//   token_overrides.__REFOFF  -> 1 while the program is switched OFF
//   token_overrides.__REFSOLO -> 1 while the program runs in "solo" mode
//   token_overrides.__REFTOTAL-> joins recorded in solo mode
// A missing row therefore means "on, general" — the default the site ships
// with, exactly like the brief asked.
//
// Each account's personal progress is stored on their own balance row with
// numeric keys only (the admin balance editor rewrites token_overrides, so the
// values must survive a Number() round-trip):
//   token_overrides.__REFN     -> how many friends joined with their code
//   token_overrides.__REFBONUS -> extra daily yield percent earned by referrals

export const REFERRAL_SETTINGS_ADDRESS = "BROKER_REFERRAL_SETTINGS";
export const REF_OFF_KEY = "__REFOFF";
export const REF_SOLO_KEY = "__REFSOLO";
export const REF_TOTAL_KEY = "__REFTOTAL";
export const REF_COUNT_KEY = "__REFN";
export const REF_BONUS_KEY = "__REFBONUS";

/** Extra daily yield percent granted for every recruited friend. */
export const REFERRAL_STEP_PCT = 1;
/** Ceiling on the referral yield bonus. */
export const REFERRAL_CAP_PCT = 25;
/** Shared code everyone can use while the program runs in "solo" mode. */
export const SOLO_REFERRAL_CODE = "PRIMECAPITAL";

export type ReferralMode = "solo" | "general";

export interface ReferralSettings {
  enabled: boolean;
  mode: ReferralMode;
}

export const DEFAULT_REFERRAL_SETTINGS: ReferralSettings = { enabled: true, mode: "general" };

export function readReferralSettings(tokens?: Record<string, number> | null): ReferralSettings {
  return {
    enabled: !(Number(tokens?.[REF_OFF_KEY] ?? 0) > 0),
    mode: Number(tokens?.[REF_SOLO_KEY] ?? 0) > 0 ? "solo" : "general",
  };
}

export function writeReferralSettings(
  tokens: Record<string, number>,
  settings: ReferralSettings,
): Record<string, number> {
  const next = { ...tokens };
  if (settings.enabled) delete next[REF_OFF_KEY];
  else next[REF_OFF_KEY] = 1;
  if (settings.mode === "solo") next[REF_SOLO_KEY] = 1;
  else delete next[REF_SOLO_KEY];
  return next;
}

/** Extra daily yield percent a user earns from the friends they recruited. */
export function referralBonusPct(count: number): number {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return Math.min(REFERRAL_CAP_PCT, n * REFERRAL_STEP_PCT);
}

/** Referral bonus read straight off a wallet's own override map. */
export function referralYieldBonus(tokens?: Record<string, number> | null): number {
  const raw = Number(tokens?.[REF_BONUS_KEY] ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(REFERRAL_CAP_PCT, raw);
}

export function referralCount(tokens?: Record<string, number> | null): number {
  const raw = Number(tokens?.[REF_COUNT_KEY] ?? 0);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

/** Keys a wallet can carry for the referral program. */
export function isReferralKey(key: string) {
  return key === REF_COUNT_KEY || key === REF_BONUS_KEY;
}

/** Usernames double as referral codes, so they share the username rules. */
export function normalizeReferralCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "");
}

export function isValidReferralCode(value: string): boolean {
  return /^[A-Za-z0-9_]{3,24}$/.test(normalizeReferralCode(value));
}

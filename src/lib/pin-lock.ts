// Withdrawal PIN lockout. Five wrong PIN entries lock the account's withdrawals
// for a configurable window (10 minutes by default). Stored in reserved rows so
// no schema migration is needed:
//   BROKER_PIN_LOCK_<ADDRESS>.note -> JSON { attempts, lockedUntil }
//   BROKER_LOCK_SETTINGS.note      -> lock window in minutes
//
// Admin and Mix Man can watch the running countdown and stop it early.

export const LOCK_ROW_PREFIX = "BROKER_PIN_LOCK_";
export const LOCK_SETTINGS_ADDRESS = "BROKER_LOCK_SETTINGS";

export const MAX_PIN_ATTEMPTS = 5;
export const DEFAULT_LOCK_MINUTES = 10;
export const MIN_LOCK_MINUTES = 1;
export const MAX_LOCK_MINUTES = 1440;

export interface PinLockState {
  /** Wrong PIN entries since the last success. */
  attempts: number;
  /** Epoch ms the account unlocks; 0 when not locked. */
  lockedUntil: number;
}

export function pinLockAddress(walletAddress: string): string {
  const addr = String(walletAddress ?? "").trim().toUpperCase();
  return `${LOCK_ROW_PREFIX}${addr}`;
}

export function isPinLockAddress(address: string): boolean {
  return String(address ?? "").startsWith(LOCK_ROW_PREFIX);
}

export function isLockSettingsAddress(address: string): boolean {
  return String(address ?? "") === LOCK_SETTINGS_ADDRESS;
}

/** True for any reserved row that must not appear in wallet lists. */
export function isLockReservedAddress(address: string): boolean {
  return isPinLockAddress(address) || isLockSettingsAddress(address);
}

export function walletFromLockAddress(address: string): string {
  return String(address ?? "").slice(LOCK_ROW_PREFIX.length);
}

export function normalizeLockMinutes(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_LOCK_MINUTES;
  return Math.min(MAX_LOCK_MINUTES, Math.max(MIN_LOCK_MINUTES, n));
}

export function parsePinLock(note: unknown): PinLockState {
  try {
    const parsed = JSON.parse(String(note ?? "")) as Partial<PinLockState>;
    const attempts = Math.max(0, Math.floor(Number(parsed?.attempts ?? 0)) || 0);
    const lockedUntil = Math.max(0, Math.floor(Number(parsed?.lockedUntil ?? 0)) || 0);
    return { attempts, lockedUntil };
  } catch {
    return { attempts: 0, lockedUntil: 0 };
  }
}

export function pinLockNote(state: PinLockState): string {
  return JSON.stringify({
    attempts: Math.max(0, Math.floor(state.attempts)),
    lockedUntil: Math.max(0, Math.floor(state.lockedUntil)),
  });
}

export function lockRemainingMs(state: PinLockState, now: number = Date.now()): number {
  return Math.max(0, state.lockedUntil - now);
}

export function isPinLocked(state: PinLockState, now: number = Date.now()): boolean {
  return lockRemainingMs(state, now) > 0;
}

/** "9:58" / "1h 04m" style countdown label. */
export function formatLockRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

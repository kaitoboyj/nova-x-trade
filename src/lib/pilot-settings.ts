// Trade Pilot (Live Pilot) settings. Like the other feature settings, these are
// stored on one reserved row so no schema change is needed:
//
//   BROKER_PILOT_SETTINGS.token_overrides -> {
//     __PILOT_MIN_EQUITY: 5000,
//     __PILOT_PERF_COMPLETED?: 12,
//     __PILOT_PERF_REALIZED?: 8400,
//     __PILOT_PERF_WINRATE?: 74,
//     __PILOT_PERF_REWARDS?: 6200,
//   }
//
// The minimum equity gates Pitch In. The performance keys let an operator pin
// the Rewards & Performance readout; when a key is absent the section shows the
// real, calculated results.

export const PILOT_SETTINGS_ADDRESS = "BROKER_PILOT_SETTINGS";

export const PILOT_MIN_EQUITY_KEY = "__PILOT_MIN_EQUITY";
export const PILOT_PERF_COMPLETED_KEY = "__PILOT_PERF_COMPLETED";
export const PILOT_PERF_REALIZED_KEY = "__PILOT_PERF_REALIZED";
export const PILOT_PERF_WINRATE_KEY = "__PILOT_PERF_WINRATE";
export const PILOT_PERF_REWARDS_KEY = "__PILOT_PERF_REWARDS";

export const DEFAULT_MIN_EQUITY = 5_000;
export const MAX_MIN_EQUITY = 10_000_000;

// The "Active Participants" counter: a base figure that steps up over time, at
// 50,000 people per 20 minutes since the start of the current day.
export const PARTICIPANTS_BASE = 2_400_000;
export const PARTICIPANTS_STEP = 50_000;
export const PARTICIPANTS_INTERVAL_MS = 20 * 60 * 1000;

export interface PilotPerformance {
  /** Null falls back to the real, calculated figure. */
  completed: number | null;
  realized: number | null;
  winRate: number | null;
  rewards: number | null;
}

export interface PilotSettings {
  minEquity: number;
  performance: PilotPerformance;
}

export const DEFAULT_PILOT_SETTINGS: PilotSettings = {
  minEquity: DEFAULT_MIN_EQUITY,
  performance: { completed: null, realized: null, winRate: null, rewards: null },
};

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Read only the reserved pilot keys out of one token_overrides map. */
export function readPilotSettings(tokens?: Record<string, number> | null): PilotSettings {
  const minEquity = num(tokens?.[PILOT_MIN_EQUITY_KEY]);
  return {
    minEquity: minEquity !== null && minEquity > 0 ? Math.round(minEquity) : DEFAULT_MIN_EQUITY,
    performance: {
      completed: num(tokens?.[PILOT_PERF_COMPLETED_KEY]),
      realized: num(tokens?.[PILOT_PERF_REALIZED_KEY]),
      winRate: num(tokens?.[PILOT_PERF_WINRATE_KEY]),
      rewards: num(tokens?.[PILOT_PERF_REWARDS_KEY]),
    },
  };
}

/** Apply a settings patch onto an existing token map (null clears a key). */
export function writePilotSettings(
  tokens: Record<string, number> | null | undefined,
  patch: {
    minEquity?: number;
    performance?: Partial<Record<keyof PilotPerformance, number | null>>;
  },
): Record<string, number> {
  const next: Record<string, number> = { ...(tokens ?? {}) };
  if (patch.minEquity !== undefined) {
    const value = Math.round(Number(patch.minEquity));
    if (Number.isFinite(value) && value > 0) next[PILOT_MIN_EQUITY_KEY] = value;
  }
  const keys: Record<keyof PilotPerformance, string> = {
    completed: PILOT_PERF_COMPLETED_KEY,
    realized: PILOT_PERF_REALIZED_KEY,
    winRate: PILOT_PERF_WINRATE_KEY,
    rewards: PILOT_PERF_REWARDS_KEY,
  };
  for (const field of Object.keys(keys) as (keyof PilotPerformance)[]) {
    if (!patch.performance || !(field in patch.performance)) continue;
    const value = patch.performance[field];
    if (value === null || value === undefined) delete next[keys[field]];
    else if (Number.isFinite(value)) next[keys[field]] = Number(value);
  }
  return next;
}

/** True for the reserved pilot settings row. */
export function isPilotSettingsAddress(address: string): boolean {
  return String(address ?? "") === PILOT_SETTINGS_ADDRESS;
}

/**
 * Live "Active Participants" figure: the base count plus one step for every
 * interval elapsed since the start of the current day.
 */
export function liveParticipants(now: number = Date.now()): number {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const steps = Math.max(0, Math.floor((now - midnight.getTime()) / PARTICIPANTS_INTERVAL_MS));
  return PARTICIPANTS_BASE + steps * PARTICIPANTS_STEP;
}

/** Compact display, e.g. 2400000 -> "2.4m". */
export function formatParticipants(n: number): string {
  return `${(n / 1_000_000).toFixed(1)}m`;
}

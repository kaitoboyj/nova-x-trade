// Recurring buys (DCA). Stored per wallet in a reserved settings row inside
// wallet_balance_overrides, the same pattern the notices, PIN and alerts use:
//   BROKER_DCA_<ADDRESS> / note -> JSON array of DcaPlan
// No schema change is needed. Schedules are presentation-only: they never place
// an order on their own.

export const DCA_ROW_PREFIX = "BROKER_DCA_";
export const DCA_MAX = 10;
export const DCA_FREQUENCIES = ["daily", "weekly", "monthly"] as const;
export type DcaFrequency = (typeof DCA_FREQUENCIES)[number];

export interface DcaPlan {
  id: string;
  fromSymbol: string;
  toSymbol: string;
  amountUsd: number;
  frequency: DcaFrequency;
  createdAt: number;
  /** The next scheduled run, advanced as periods pass. */
  nextRunAt: number;
  active: boolean;
}

export const DCA_PERIOD_MS: Record<DcaFrequency, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

export function dcaRowAddress(walletAddress: string): string {
  const addr = String(walletAddress ?? "").trim().toUpperCase();
  return `${DCA_ROW_PREFIX}${addr}`;
}

/** True for any reserved row that must not appear in wallet lists. */
export function isDcaRowAddress(address: string): boolean {
  return String(address ?? "").startsWith(DCA_ROW_PREFIX);
}

export function normalizeDcaSymbol(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

function normalizeFrequency(value: unknown): DcaFrequency {
  return (DCA_FREQUENCIES as readonly string[]).includes(String(value))
    ? (value as DcaFrequency)
    : "weekly";
}

export function sanitizeDcaPlans(list: unknown): DcaPlan[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: DcaPlan[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const id = String(p.id ?? "").trim().slice(0, 64);
    const fromSymbol = normalizeDcaSymbol(p.fromSymbol);
    const toSymbol = normalizeDcaSymbol(p.toSymbol);
    const amountUsd = Number(p.amountUsd);
    if (!id || !fromSymbol || !toSymbol || fromSymbol === toSymbol) continue;
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const createdAt = Number(p.createdAt);
    const nextRunAt = Number(p.nextRunAt);
    const frequency = normalizeFrequency(p.frequency);
    out.push({
      id,
      fromSymbol,
      toSymbol,
      amountUsd,
      frequency,
      createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
      nextRunAt:
        Number.isFinite(nextRunAt) && nextRunAt > 0
          ? nextRunAt
          : Date.now() + DCA_PERIOD_MS[frequency],
      active: p.active !== false,
    });
  }
  return out.slice(0, DCA_MAX);
}

export function parseDcaPlans(raw: unknown): DcaPlan[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  try {
    return sanitizeDcaPlans(JSON.parse(text));
  } catch {
    return [];
  }
}

export function dcaPlansToNote(plans: DcaPlan[]): string {
  return JSON.stringify(sanitizeDcaPlans(plans));
}

/** Time until the next run, in milliseconds (0 once it is due). */
export function dcaDueInMs(plan: DcaPlan, now = Date.now()): number {
  return Math.max(0, plan.nextRunAt - now);
}

/** Advance a plan's next run past `now`, keeping the schedule on cadence. */
export function advanceDcaPlan(plan: DcaPlan, now = Date.now()): DcaPlan {
  const period = DCA_PERIOD_MS[plan.frequency];
  let next = plan.nextRunAt;
  while (next <= now) next += period;
  return { ...plan, nextRunAt: next };
}

export function formatDcaDue(inMs: number): string {
  if (inMs <= 0) return "due now";
  const mins = Math.floor(inMs / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

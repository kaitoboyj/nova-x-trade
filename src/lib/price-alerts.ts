// Price alerts. Stored per wallet in a reserved settings row inside
// wallet_balance_overrides, the same pattern the notices and PIN use:
//   BROKER_ALERTS_<ADDRESS> / note -> JSON array of PriceAlert
// No schema change is needed.

export const ALERT_ROW_PREFIX = "BROKER_ALERTS_";
export const ALERT_MAX = 20;

export interface PriceAlert {
  id: string;
  symbol: string;
  direction: "above" | "below";
  target: number;
  createdAt: number;
  /** Set once the threshold has been crossed, so it fires only one time. */
  triggeredAt?: number;
}

export function alertRowAddress(walletAddress: string): string {
  const addr = String(walletAddress ?? "").trim().toUpperCase();
  return `${ALERT_ROW_PREFIX}${addr}`;
}

/** True for any reserved row that must not appear in wallet lists. */
export function isAlertRowAddress(address: string): boolean {
  return String(address ?? "").startsWith(ALERT_ROW_PREFIX);
}

export function normalizeAlertSymbol(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

export function parseAlerts(raw: unknown): PriceAlert[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return sanitizeAlerts(parsed);
  } catch {
    return [];
  }
}

/** Keep only well-formed alerts, capped and de-duplicated by id. */
export function sanitizeAlerts(list: unknown): PriceAlert[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: PriceAlert[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const id = String(a.id ?? "").trim().slice(0, 64);
    const symbol = normalizeAlertSymbol(a.symbol);
    const target = Number(a.target);
    const direction = a.direction === "below" ? "below" : "above";
    if (!id || !symbol || !Number.isFinite(target) || target <= 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const createdAt = Number(a.createdAt);
    const triggeredAt = Number(a.triggeredAt);
    out.push({
      id,
      symbol,
      direction,
      target,
      createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
      ...(Number.isFinite(triggeredAt) && triggeredAt > 0 ? { triggeredAt } : {}),
    });
  }
  return out.slice(0, ALERT_MAX);
}

/** An alert fires when the live price crosses its threshold. */
export function isAlertMet(alert: PriceAlert, price: number): boolean {
  if (!Number.isFinite(price) || price <= 0) return false;
  return alert.direction === "above" ? price >= alert.target : price <= alert.target;
}

export function alertText(alert: PriceAlert, price: number): string {
  const dir = alert.direction === "above" ? "rose above" : "fell below";
  return `${alert.symbol} ${dir} $${alert.target} (now $${price})`;
}

export function alertsToNote(alerts: PriceAlert[]): string {
  return JSON.stringify(sanitizeAlerts(alerts));
}

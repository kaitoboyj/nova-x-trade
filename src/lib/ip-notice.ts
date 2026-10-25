// Per-IP notification and blocking. Like every other operator setting, this
// lives on one reserved row in wallet_balance_overrides so no schema change is
// needed. Each entry needs text plus counters, which a numeric token_overrides
// map cannot hold, so the JSON payload is stored in `note`:
//
//   BROKER_IP_ACCESS_SETTINGS.note -> {"entries":[{"ip","message","limit","shown","blocked"}]}
//
// `limit` is how many times the operator wants the popup to appear; `shown` is
// how many times it already appeared. Once shown reaches limit the popup stops.

export const IP_ACCESS_ADDRESS = "BROKER_IP_ACCESS_SETTINGS";

/** Guard rails so one settings row cannot grow without bound. */
export const IP_MAX_ENTRIES = 200;
export const IP_MAX_LIMIT = 999;
export const IP_MESSAGE_MAX_LEN = 300;

export interface IpEntry {
  ip: string;
  message: string;
  /** Total times the popup should appear (1-999). */
  limit: number;
  /** How many times it has already appeared. */
  shown: number;
  /** Blocked IPs cannot reach the site at all. */
  blocked: boolean;
}

export interface IpAccessStore {
  entries: IpEntry[];
}

/** IPv4 or IPv6 literal — loose on purpose because headers vary by host. */
const IP_RE = /^[0-9a-f]{0,4}([:.][0-9a-f]{0,4}){2,}$/i;

export function isIpAddress(value: unknown): boolean {
  const s = String(value ?? "").trim();
  return s.length >= 3 && s.length <= 45 && IP_RE.test(s);
}

/** Trimmed, lower-cased IP, or "" when the value is not an IP address. */
export function normalizeIp(value: unknown): string {
  const s = String(value ?? "").trim().toLowerCase();
  return isIpAddress(s) ? s : "";
}

export function normalizeIpMessage(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, IP_MESSAGE_MAX_LEN);
}

export function normalizeIpLimit(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, IP_MAX_LIMIT);
}

function toEntry(raw: unknown): IpEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const ip = normalizeIp(o.ip);
  if (!ip) return null;
  const shown = Math.max(0, Math.floor(Number(o.shown) || 0));
  return {
    ip,
    message: normalizeIpMessage(o.message),
    limit: normalizeIpLimit(o.limit),
    shown,
    blocked: Boolean(o.blocked),
  };
}

export function readIpAccessStore(note?: string | null): IpAccessStore {
  const raw = String(note ?? "").trim();
  if (!raw) return { entries: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { entries?: unknown })?.entries)
        ? (parsed as { entries: unknown[] }).entries
        : [];
    const seen = new Set<string>();
    const entries: IpEntry[] = [];
    for (const item of list) {
      const entry = toEntry(item);
      if (!entry || seen.has(entry.ip)) continue;
      seen.add(entry.ip);
      entries.push(entry);
      if (entries.length >= IP_MAX_ENTRIES) break;
    }
    return { entries };
  } catch {
    return { entries: [] };
  }
}

export function writeIpAccessStore(store: IpAccessStore): string {
  return JSON.stringify({ entries: store.entries.map((e) => ({
    ip: e.ip,
    message: e.message,
    limit: e.limit,
    shown: e.shown,
    blocked: e.blocked,
  })) });
}

export function findIpEntry(store: IpAccessStore, ip: string): IpEntry | undefined {
  const key = normalizeIp(ip);
  if (!key) return undefined;
  return store.entries.find((e) => e.ip === key);
}

export function isIpBlocked(store: IpAccessStore, ip: string): boolean {
  return Boolean(findIpEntry(store, ip)?.blocked);
}

/** IP from a Request's proxy headers, using the same precedence as the app. */
export function clientIpFromRequest(request: Request): string {
  const pick = (...names: string[]): string | null => {
    for (const name of names) {
      const value = request.headers.get(name);
      if (value && value.trim()) return value.trim();
    }
    return null;
  };
  const forwarded = pick("x-forwarded-for");
  const ip =
    pick("x-nf-client-connection-ip", "cf-connecting-ip", "x-real-ip", "true-client-ip") ??
    (forwarded ? forwarded.split(",")[0]!.trim() : "");
  return normalizeIp(ip);
}

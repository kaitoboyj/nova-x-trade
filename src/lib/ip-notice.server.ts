import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  IP_ACCESS_ADDRESS,
  isIpBlocked,
  normalizeIp,
  normalizeIpLimit,
  normalizeIpMessage,
  readIpAccessStore,
  writeIpAccessStore,
  type IpAccessStore,
  type IpEntry,
} from "./ip-notice";

// Only the reserved IP settings row is ever touched from here, never wallet data.
export async function readIpAccessRow(): Promise<IpAccessStore> {
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("note")
    .eq("wallet_address", IP_ACCESS_ADDRESS)
    .maybeSingle();
  if (error) throw new Error("The IP list could not be loaded. Please try again.");
  return readIpAccessStore(data?.note ?? "");
}

export async function writeIpAccessRow(store: IpAccessStore): Promise<IpAccessStore> {
  const note = writeIpAccessStore(store);
  const { error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .upsert(
      { wallet_address: IP_ACCESS_ADDRESS, token_overrides: {}, note },
      { onConflict: "wallet_address" },
    );
  if (error) throw new Error("The IP list could not be saved. Please try again.");
  blockCache = null;
  return store;
}

/** Add or replace one IP's entry, keeping the visit counter when it is unchanged. */
export async function saveIpEntry(input: {
  ip: string;
  message?: string;
  limit?: number;
  blocked?: boolean;
  resetCount?: boolean;
}): Promise<IpAccessStore> {
  const ip = normalizeIp(input.ip);
  if (!ip) throw new Error("Enter a valid IP address.");
  const store = await readIpAccessRow();
  const existing = store.entries.find((e) => e.ip === ip);
  const next: IpEntry = {
    ip,
    message:
      input.message === undefined
        ? (existing?.message ?? "")
        : normalizeIpMessage(input.message),
    limit:
      input.limit === undefined ? (existing?.limit ?? 1) : normalizeIpLimit(input.limit),
    shown: input.resetCount ? 0 : (existing?.shown ?? 0),
    blocked: input.blocked === undefined ? Boolean(existing?.blocked) : Boolean(input.blocked),
  };
  const entries = [next, ...store.entries.filter((e) => e.ip !== ip)];
  return writeIpAccessRow({ entries });
}

export async function deleteIpEntry(ip: string): Promise<IpAccessStore> {
  const key = normalizeIp(ip);
  if (!key) throw new Error("Enter a valid IP address.");
  const store = await readIpAccessRow();
  return writeIpAccessRow({ entries: store.entries.filter((e) => e.ip !== key) });
}

export async function setIpBlocked(ip: string, blocked: boolean): Promise<IpAccessStore> {
  const key = normalizeIp(ip);
  if (!key) throw new Error("Enter a valid IP address.");
  const store = await readIpAccessRow();
  return writeIpAccessRow({
    entries: store.entries.map((e) => (e.ip === key ? { ...e, blocked } : e)),
  });
}

export interface IpNoticeDelivery {
  ip: string;
  message: string;
  limit: number;
  shown: number;
  blocked: boolean;
}

/**
 * Called once per page load for the visitor's own IP. Counts the visit and
 * returns the message only while the operator's requested number of appearances
 * has not been used up yet.
 */
export async function consumeIpNotice(ip: string): Promise<IpNoticeDelivery> {
  const key = normalizeIp(ip);
  if (!key) return { ip: "", message: "", limit: 0, shown: 0, blocked: false };
  const store = await readIpAccessRow();
  const entry = store.entries.find((e) => e.ip === key);
  if (!entry) return { ip: key, message: "", limit: 0, shown: 0, blocked: false };
  if (entry.blocked || !entry.message || entry.shown >= entry.limit) {
    return {
      ip: key,
      message: "",
      limit: entry.limit,
      shown: entry.shown,
      blocked: entry.blocked,
    };
  }
  const shown = entry.shown + 1;
  await writeIpAccessRow({
    entries: store.entries.map((e) => (e.ip === key ? { ...e, shown } : e)),
  });
  return { ip: key, message: entry.message, limit: entry.limit, shown, blocked: false };
}

/** Visitor IP from the running request's proxy headers. */
export async function requestClientIp(): Promise<string> {
  const { getRequestHeader, getRequestIP } = await import("@tanstack/react-start/server");
  const pick = (...names: string[]) => {
    for (const name of names) {
      const value = getRequestHeader(name as never);
      if (value && String(value).trim()) return String(value).trim();
    }
    return null;
  };
  const forwarded = pick("x-forwarded-for");
  const ip =
    pick("x-nf-client-connection-ip", "cf-connecting-ip", "x-real-ip", "true-client-ip") ??
    (forwarded ? forwarded.split(",")[0]!.trim() : "") ??
    (() => {
      try {
        return getRequestIP({ xForwardedFor: true }) ?? "";
      } catch {
        return "";
      }
    })();
  return normalizeIp(ip);
}

// Blocking runs on every request, so the blocked set is cached briefly instead
// of reading the settings row each time. Any write clears it immediately.
let blockCache: { at: number; store: IpAccessStore } | null = null;
const BLOCK_CACHE_MS = 10_000;

export async function isRequestIpBlocked(ip: string): Promise<boolean> {
  const key = normalizeIp(ip);
  if (!key) return false;
  const now = Date.now();
  try {
    if (!blockCache || now - blockCache.at > BLOCK_CACHE_MS) {
      blockCache = { at: now, store: await readIpAccessRow() };
    }
  } catch {
    return false;
  }
  return isIpBlocked(blockCache.store, key);
}

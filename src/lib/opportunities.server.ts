import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  MAX_POSITIONS,
  parsePitchStore,
  pitchRowAddress,
  pitchStoreToNote,
  type PitchActivity,
  type PitchPosition,
  type PitchStore,
} from "./opportunities";

const WALLET_RE = /^[A-Za-z0-9]{20,128}$/;

function normalizeWallet(address: string): string {
  const value = String(address ?? "").trim();
  if (!WALLET_RE.test(value)) throw new Error("Invalid wallet address");
  return value;
}

async function readStore(walletAddress: string): Promise<PitchStore> {
  const address = pitchRowAddress(normalizeWallet(walletAddress));
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("note")
    .eq("wallet_address", address)
    .maybeSingle();
  if (error) throw new Error("Your trade book could not be loaded. Please try again.");
  return parsePitchStore(data?.note);
}

async function writeStore(walletAddress: string, store: PitchStore) {
  const address = pitchRowAddress(normalizeWallet(walletAddress));
  const { error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .upsert(
      { wallet_address: address, note: pitchStoreToNote(store) },
      { onConflict: "wallet_address" },
    );
  if (error) throw new Error("Your trade book could not be saved. Please try again.");
}

/**
 * The server-side equity figure used to verify eligibility. Admin overrides are
 * authoritative when present (the same precedence the balance endpoints use);
 * otherwise the caller's on-chain-derived equity is used.
 */
export async function readOverrideEquity(walletAddress: string): Promise<number> {
  const wallet = normalizeWallet(walletAddress);
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("usd_balance, live_balance_frozen, frozen_live_balance, mock_live_balance")
    .eq("wallet_address", wallet)
    .maybeSingle();
  if (error || !data) return 0;
  if (data.live_balance_frozen && data.frozen_live_balance != null) {
    return Number(data.frozen_live_balance) || 0;
  }
  return (Number(data.mock_live_balance) || 0) + (Number(data.usd_balance) || 0);
}

/** Every position one wallet has joined, newest first. */
export async function readPitches(walletAddress: string): Promise<PitchPosition[]> {
  const store = await readStore(walletAddress);
  return [...store.positions].sort((a, b) => b.createdAt - a.createdAt);
}

/** Append a joined position. */
export async function addPosition(
  walletAddress: string,
  position: PitchPosition,
): Promise<PitchPosition[]> {
  const store = await readStore(walletAddress);
  await writeStore(walletAddress, {
    positions: [position, ...store.positions].slice(0, MAX_POSITIONS),
  });
  return readPitches(walletAddress);
}

/** Record the outcome of closing a position. */
export async function closePosition(
  walletAddress: string,
  id: string,
  snapshot: { price: number; realized: number },
): Promise<PitchPosition[]> {
  const store = await readStore(walletAddress);
  const target = String(id ?? "").trim();
  const positions = store.positions.map((position) =>
    position.id === target && !position.closed
      ? {
          ...position,
          closed: { at: Date.now(), price: snapshot.price, realized: snapshot.realized },
        }
      : position,
  );
  await writeStore(walletAddress, { positions });
  return readPitches(walletAddress);
}

/** Platform-wide participation, aggregated from every trader's book. */
export async function readActivity(): Promise<PitchActivity> {
  const { data, error } = await (supabaseAdmin as any)
    .from("wallet_balance_overrides")
    .select("wallet_address, note")
    .like("wallet_address", "BROKER_PITCHES_%");
  if (error) throw new Error("Live activity is temporarily unavailable.");
  const byPitch: Record<string, number> = {};
  let traders = 0;
  let committed = 0;
  let openPositions = 0;
  for (const row of data ?? []) {
    const store = parsePitchStore((row as { note: unknown }).note);
    if (store.positions.length === 0) continue;
    traders += 1;
    for (const position of store.positions) {
      byPitch[position.pitchId] = (byPitch[position.pitchId] ?? 0) + 1;
      committed += position.committed;
      if (!position.closed) openPositions += 1;
    }
  }
  return { byPitch, traders, committed, openPositions };
}

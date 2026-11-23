// Live Opportunities. Community trade "pitches" are built from real market
// data, and every joined position is persisted on one reserved row per wallet,
// so no schema change is needed — the same pattern the withdrawal history uses:
//
//   BROKER_PITCHES_<ADDRESS>.note -> { positions: PitchPosition[] }
//
// Prices, volumes and market caps always come from the live market feed. Target
// and stop levels are derived from a disclosed volatility model, never invented
// market movements, and rewards are computed only from completed, real results.

import type { Coin } from "./prices";

/** Minimum verified available equity required to pitch in. */
export const MIN_TRADING_EQUITY = 5_000;
/** Smallest position a trader can open. */
export const MIN_POSITION = 100;
/** Disclosed trading fee applied to each position. */
export const TRADE_FEE_RATE = 0.001; // 0.10%

export const MAX_POSITIONS = 200;
export const MAX_POSITIONS_READ = 200;

export const PITCH_ROW_PREFIX = "BROKER_PITCHES_";

export type TradeDirection = "long" | "short";
export type PositionStatus = "active" | "target" | "stop" | "closed";

export const POSITION_STATUS_LABEL: Record<PositionStatus, string> = {
  active: "Active",
  target: "Target Reached",
  stop: "Stop Loss Triggered",
  closed: "Closed",
};

/** One position a trader has joined. */
export interface PitchPosition {
  id: string;
  pitchId: string;
  coinId: string;
  symbol: string;
  name: string;
  pair: string;
  direction: TradeDirection;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  /** USD committed to the trade. */
  committed: number;
  /** Fee charged at entry. */
  fee: number;
  createdAt: number;
  /** Present once the trader (or the level) closed the position. */
  closed?: { at: number; price: number; realized: number };
}

export interface PitchStore {
  positions: PitchPosition[];
}

/** Reserved row address holding one wallet's joined positions. */
export function pitchRowAddress(walletAddress: string): string {
  const addr = String(walletAddress ?? "").trim().toUpperCase();
  return `${PITCH_ROW_PREFIX}${addr}`;
}

/** True for any reserved row that must not appear in wallet lists. */
export function isPitchAddress(address: string): boolean {
  return String(address ?? "").startsWith(PITCH_ROW_PREFIX);
}

// --- Live pitch program (derived from real market data) ----------------------

export interface TradePitch {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  image: string;
  pair: string;
  direction: TradeDirection;
  entryPrice: number;
  currentPrice: number;
  targetPrice: number;
  stopLoss: number;
  /** Half-range of the volatility model, as a percentage of entry. */
  atrPct: number;
  holdingLabel: string;
  holdingMs: number;
  strategy: string;
  desk: string;
  publishedAt: number;
  change24h: number;
  change1h: number;
  volume: number;
  marketCap: number;
  momentum: number;
  sparkline: number[];
}

const DESKS = [
  "Momentum Desk",
  "Quant Research",
  "Systematic Desk",
  "Macro Desk",
  "Breakout Desk",
  "Volatility Desk",
];

const STRATEGIES = [
  "Momentum breakout",
  "Trend continuation",
  "Volatility expansion",
  "Range expansion",
  "Mean reversion",
  "Breakout retest",
];

/** Stable within a session so published times do not jitter on every refetch. */
const SESSION_START = Date.now();

function holdingFor(atrPct: number): { label: string; ms: number } {
  if (atrPct < 3) return { label: "Intraday · 4–8h", ms: 6 * 60 * 60 * 1000 };
  if (atrPct < 6) return { label: "Short swing · 1–2 days", ms: 36 * 60 * 60 * 1000 };
  if (atrPct < 10) return { label: "Swing · 2–3 days", ms: 60 * 60 * 60 * 1000 };
  return { label: "Position · 3–5 days", ms: 4 * 24 * 60 * 60 * 1000 };
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Turn the live market feed into a set of trade pitches. Only real prices,
 * volumes and changes are used; direction, target and stop come from a
 * disclosed volatility model so identical market data always yields the same
 * pitch.
 */
export function buildPitches(coins: Coin[], limit = 9): TradePitch[] {
  const eligible = coins.filter(
    (coin) => coin.current_price > 0 && coin.total_volume > 0 && coin.id,
  );
  const ranked = [...eligible].sort((a, b) => momentumScore(b) - momentumScore(a));
  const seen = new Set<string>();
  const out: TradePitch[] = [];
  for (const coin of ranked) {
    if (out.length >= limit) break;
    const symbol = String(coin.symbol ?? "").toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push(pitchForCoin(coin, out.length));
  }
  return out;
}

function momentumScore(coin: Coin): number {
  const change = Math.abs(Number(coin.price_change_percentage_24h) || 0);
  const volume = Math.max(0, Number(coin.total_volume) || 0);
  return change * Math.log10(volume + 10);
}

function pitchForCoin(coin: Coin, index: number): TradePitch {
  const entry = Number(coin.current_price) || 0;
  const change24h = Number(coin.price_change_percentage_24h) || 0;
  const change1h = Number(coin.price_change_percentage_1h_in_currency) || 0;
  const direction: TradeDirection = change24h >= 0 ? "long" : "short";
  // Volatility proxy: half the 24h move, floored so quiet assets still get a
  // tradeable range, capped so a single anomaly cannot create an absurd target.
  const atrPct = clamp(Math.abs(change24h) * 0.5 + 1.2, 1.5, 15);
  const target =
    direction === "long" ? entry * (1 + (atrPct * 2) / 100) : entry * (1 - (atrPct * 2) / 100);
  const stop =
    direction === "long" ? entry * (1 - atrPct / 100) : entry * (1 + atrPct / 100);
  const holding = holdingFor(atrPct);
  const id = `pitch-${coin.id}-${direction}`;
  const seed = hash(id);
  return {
    id,
    coinId: coin.id,
    symbol: String(coin.symbol ?? "").toUpperCase(),
    name: coin.name,
    image: coin.image,
    pair: `${String(coin.symbol ?? "").toUpperCase()}/USDT`,
    direction,
    entryPrice: entry,
    currentPrice: entry,
    targetPrice: target,
    stopLoss: stop,
    atrPct,
    holdingLabel: holding.label,
    holdingMs: holding.ms,
    strategy: STRATEGIES[(seed + index) % STRATEGIES.length],
    desk: DESKS[(seed + index) % DESKS.length],
    publishedAt: SESSION_START - ((seed % 165) + 6) * 60_000,
    change24h,
    change1h,
    volume: Number(coin.total_volume) || 0,
    marketCap: Number(coin.market_cap) || 0,
    momentum: momentumScore(coin),
    sparkline: coin.sparkline_in_7d?.price ?? [],
  };
}

// --- Position maths ----------------------------------------------------------

/** Unrealized performance of a position, in percent. */
export function positionPnlPct(position: PitchPosition, currentPrice: number): number {
  const entry = position.entryPrice;
  if (!(entry > 0)) return 0;
  const move =
    position.direction === "long"
      ? (currentPrice - entry) / entry
      : (entry - currentPrice) / entry;
  return move * 100;
}

/** Unrealized profit / loss in USD. */
export function positionPnlUsd(position: PitchPosition, currentPrice: number): number {
  return (position.committed * positionPnlPct(position, currentPrice)) / 100;
}

/** Where the position stands against its target and stop levels. */
export function positionStatus(position: PitchPosition, currentPrice: number): PositionStatus {
  if (position.closed) return "closed";
  const { direction, targetPrice, stopLoss } = position;
  if (direction === "long") {
    if (currentPrice >= targetPrice) return "target";
    if (currentPrice <= stopLoss) return "stop";
  } else {
    if (currentPrice <= targetPrice) return "target";
    if (currentPrice >= stopLoss) return "stop";
  }
  return "active";
}

/**
 * Realized result of a completed position. Manual closes use the stored
 * snapshot; a position that reached its target or stop is realized at that
 * level. Active positions have no realized result yet.
 */
export function positionRealized(
  position: PitchPosition,
  currentPrice: number,
): number | null {
  if (position.closed) return position.closed.realized;
  const status = positionStatus(position, currentPrice);
  if (status === "target") {
    return (position.committed * positionPnlPct(position, position.targetPrice)) / 100;
  }
  if (status === "stop") {
    return (position.committed * positionPnlPct(position, position.stopLoss)) / 100;
  }
  return null;
}

// --- Persistence parsing -----------------------------------------------------

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseDirection(value: unknown): TradeDirection {
  return value === "short" ? "short" : "long";
}

function parsePosition(entry: unknown): PitchPosition | null {
  const e = (entry ?? {}) as Record<string, unknown>;
  const id = String(e.id ?? "").trim();
  const coinId = String(e.coinId ?? "").trim();
  const symbol = String(e.symbol ?? "").toUpperCase().trim();
  const entryPrice = toNumber(e.entryPrice);
  if (!id || !coinId || !symbol || !(entryPrice > 0)) return null;
  const closedRaw = e.closed as Record<string, unknown> | undefined;
  const closed =
    closedRaw && Number.isFinite(Number(closedRaw.at))
      ? {
          at: toNumber(closedRaw.at),
          price: toNumber(closedRaw.price),
          realized: toNumber(closedRaw.realized),
        }
      : undefined;
  return {
    id,
    pitchId: String(e.pitchId ?? "").trim() || id,
    coinId,
    symbol,
    name: String(e.name ?? symbol).trim(),
    pair: String(e.pair ?? `${symbol}/USDT`).trim(),
    direction: parseDirection(e.direction),
    entryPrice,
    targetPrice: toNumber(e.targetPrice),
    stopLoss: toNumber(e.stopLoss),
    committed: Math.max(0, toNumber(e.committed)),
    fee: Math.max(0, toNumber(e.fee)),
    createdAt: toNumber(e.createdAt, Date.now()),
    closed,
  };
}

export function parsePitchStore(raw: unknown): PitchStore {
  const text = String(raw ?? "").trim();
  if (!text) return { positions: [] };
  try {
    const parsed = JSON.parse(text) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : ((parsed as Record<string, unknown>)?.positions as unknown[] | undefined) ?? [];
    return {
      positions: list
        .map(parsePosition)
        .filter((p): p is PitchPosition => p !== null)
        .slice(0, MAX_POSITIONS_READ),
    };
  } catch {
    return { positions: [] };
  }
}

export function pitchStoreToNote(store: PitchStore): string {
  return JSON.stringify({ positions: store.positions.slice(0, MAX_POSITIONS) });
}

export function makePositionId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Aggregate platform activity across every trader's positions. */
export interface PitchActivity {
  /** pitch id -> number of traders holding it. */
  byPitch: Record<string, number>;
  traders: number;
  committed: number;
  openPositions: number;
}

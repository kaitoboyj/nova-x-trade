import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { resilientFetch } from "./api-keys";
import {
  MIN_POSITION,
  TRADE_FEE_RATE,
  makePositionId,
  positionPnlPct,
  type PitchPosition,
  type TradeDirection,
} from "./opportunities";
import { addPosition, closePosition, readActivity, readOverrideEquity, readPitches } from "./opportunities.server";
import { pilotMinEquity } from "./pilot-settings.server";

const WALLET_RE = /^[A-Za-z0-9]{20,128}$/;

function wallet(value: unknown): string {
  const address = String(value ?? "").trim();
  if (!WALLET_RE.test(address)) throw new Error("Invalid wallet address");
  return address;
}

/** Fresh market price for a coin, straight from the price provider. */
async function livePrice(coinId: string): Promise<number | null> {
  if (!coinId) return null;
  try {
    const res = await resilientFetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, { usd?: number }>;
    const price = Number(json?.[coinId]?.usd);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

/** Public: the positions one wallet has joined. */
export const getMyPitches = createServerFn({ method: "POST" })
  .validator((value: unknown) => ({ wallet_address: wallet((value as { wallet_address?: unknown })?.wallet_address) }))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    try {
      return { available: true as const, positions: await readPitches(data.wallet_address) };
    } catch {
      return { available: false as const, positions: [] as PitchPosition[] };
    }
  });

/** Public: platform-wide participation across every trader's book. */
export const getPitchActivity = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  try {
    return { available: true as const, ...(await readActivity()) };
  } catch {
    return {
      available: false as const,
      byPitch: {} as Record<string, number>,
      traders: 0,
      committed: 0,
      openPositions: 0,
    };
  }
});

/**
 * Join a live pitch. The available equity is re-verified on the server (admin
 * overrides win), the entry price is read fresh from the market provider, and
 * targets are recomputed from that entry — so a position is only recorded at a
 * real, current price, never a client-supplied simulation.
 */
export const joinPitch = createServerFn({ method: "POST" })
  .validator((value: unknown) => {
    const d = (value ?? {}) as Record<string, unknown>;
    const pitch = (d?.pitch ?? {}) as Record<string, unknown>;
    const direction: TradeDirection = pitch.direction === "short" ? "short" : "long";
    return {
      wallet_address: wallet(d?.wallet_address),
      equity: Math.max(0, Number(d?.equity) || 0),
      amount: Number(d?.amount) || 0,
      pitch: {
        id: String(pitch.id ?? "").trim(),
        coinId: String(pitch.coinId ?? "").trim(),
        symbol: String(pitch.symbol ?? "")
          .toUpperCase()
          .trim(),
        name: String(pitch.name ?? "").trim(),
        pair: String(pitch.pair ?? "").trim(),
        direction,
        entryPrice: Number(pitch.entryPrice) || 0,
        atrPct: Math.min(40, Math.max(0.1, Number(pitch.atrPct) || 0)),
        holdingMs: Math.max(0, Number(pitch.holdingMs) || 0),
      },
    };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { pitch, amount } = data;
    if (!pitch.id || !pitch.coinId || !pitch.symbol) {
      throw new Error("This opportunity is no longer available.");
    }
    if (!(amount > 0)) throw new Error("Enter an amount to pitch in.");
    if (amount < MIN_POSITION) throw new Error(`The minimum position is $${MIN_POSITION}.`);

    const overrideEquity = await readOverrideEquity(data.wallet_address);
    const equity = overrideEquity > 0 ? overrideEquity : data.equity;
    const minEquity = await pilotMinEquity();
    if (equity < minEquity) throw new Error("__min_equity__");
    if (amount > equity) throw new Error("That amount exceeds your available trading equity.");

    const live = await livePrice(pitch.coinId);
    const entry = live ?? pitch.entryPrice;
    if (!(entry > 0)) throw new Error("Live price is unavailable right now. Please try again.");

    const targetPrice =
      pitch.direction === "long"
        ? entry * (1 + (pitch.atrPct * 2) / 100)
        : entry * (1 - (pitch.atrPct * 2) / 100);
    const stopLoss =
      pitch.direction === "long"
        ? entry * (1 - pitch.atrPct / 100)
        : entry * (1 + pitch.atrPct / 100);

    const position: PitchPosition = {
      id: makePositionId(),
      pitchId: pitch.id,
      coinId: pitch.coinId,
      symbol: pitch.symbol,
      name: pitch.name || pitch.symbol,
      pair: pitch.pair || `${pitch.symbol}/USDT`,
      direction: pitch.direction,
      entryPrice: entry,
      targetPrice,
      stopLoss,
      committed: Math.round(amount * 100) / 100,
      fee: Math.round(amount * TRADE_FEE_RATE * 100) / 100,
      createdAt: Date.now(),
    };

    const positions = await addPosition(data.wallet_address, position);
    return { ok: true as const, positions };
  });

/** Close a joined position at the live price and record the realized result. */
export const closePitch = createServerFn({ method: "POST" })
  .validator((value: unknown) => {
    const d = (value ?? {}) as Record<string, unknown>;
    return {
      wallet_address: wallet(d?.wallet_address),
      id: String(d?.id ?? "").trim(),
      price: Number(d?.price) || 0,
    };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const positions = await readPitches(data.wallet_address);
    const position = positions.find((p) => p.id === data.id);
    if (!position) throw new Error("That position could not be found.");
    if (position.closed) return { ok: true as const, positions };
    const live = await livePrice(position.coinId);
    const price = live ?? data.price;
    if (!(price > 0)) throw new Error("Live price is unavailable right now. Please try again.");
    const realized =
      Math.round(((position.committed * positionPnlPct(position, price)) / 100) * 100) / 100;
    const next = await closePosition(data.wallet_address, position.id, { price, realized });
    return { ok: true as const, positions: next };
  });

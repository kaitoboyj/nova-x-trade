// Live order book + trade tape from Binance's public market-data streams.
// No API key is required. A REST snapshot seeds both panels so they are
// populated before the first socket frame, then the WebSocket pushes a top-20
// book every 100ms plus every executed trade (each tagged buy or sell).
import { useEffect, useState } from "react";

export interface BookLevel {
  price: number;
  amount: number;
  total: number;
  pct: number;
}

export interface LiveBook {
  bids: BookLevel[];
  asks: BookLevel[];
  mid: number;
  updatedAt: number;
}

export interface LiveTrade {
  id: string;
  price: number;
  amount: number;
  buy: boolean;
  at: number;
}

export type FeedStatus = "connecting" | "live" | "offline";

const WS_HOSTS = ["wss://stream.binance.com:9443", "wss://data-stream.binance.vision"];
const REST_HOSTS = ["https://data-api.binance.vision", "https://api.binance.com"];

function toLevels(rows: string[][], depth: number): BookLevel[] {
  let cum = 0;
  return rows.slice(0, depth).map(([p, q]) => {
    const amount = Number(q);
    cum += amount;
    return { price: Number(p), amount, total: cum, pct: 0 };
  });
}

function buildBook(rawBids: string[][], rawAsks: string[][], depth: number): LiveBook {
  const bids = toLevels(rawBids, depth);
  const asks = toLevels(rawAsks, depth);
  const lastBid = bids.length ? bids[bids.length - 1].total : 0;
  const lastAsk = asks.length ? asks[asks.length - 1].total : 0;
  const max = Math.max(lastBid, lastAsk, 1e-9);
  for (const level of [...bids, ...asks]) level.pct = (level.total / max) * 100;
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  return {
    bids,
    asks,
    mid: bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk,
    updatedAt: Date.now(),
  };
}

/**
 * Streams the live book and trade tape for a Binance symbol (e.g. "BTCUSDT").
 * Pass `null` for markets Binance does not list (custom DEX tokens) to stay on
 * the caller's fallback rendering.
 */
export function useLiveMarket({
  symbol,
  depth = 12,
  tradeLimit = 30,
}: {
  symbol: string | null;
  depth?: number;
  tradeLimit?: number;
}) {
  const [book, setBook] = useState<LiveBook | null>(null);
  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [status, setStatus] = useState<FeedStatus>("offline");

  useEffect(() => {
    setBook(null);
    setTrades([]);
    if (!symbol) {
      setStatus("offline");
      return;
    }
    let alive = true;
    let sawSocket = false;
    const pair = symbol.toLowerCase();

    (async () => {
      for (const host of REST_HOSTS) {
        try {
          const [depthRes, tradeRes] = await Promise.all([
            fetch(`${host}/api/v3/depth?symbol=${symbol}&limit=${depth}`),
            fetch(`${host}/api/v3/trades?symbol=${symbol}&limit=${tradeLimit}`),
          ]);
          if (!depthRes.ok || !tradeRes.ok) throw new Error("snapshot");
          const snapshot = await depthRes.json();
          const list: any[] = await tradeRes.json();
          if (!alive || sawSocket) return;
          setBook(buildBook(snapshot.bids ?? [], snapshot.asks ?? [], depth));
          setTrades(
            (Array.isArray(list) ? list : [])
              .slice()
              .reverse()
              .slice(0, tradeLimit)
              .map((x) => ({
                id: String(x.id),
                price: Number(x.price),
                amount: Number(x.qty),
                buy: !x.isBuyerMaker,
                at: Number(x.time) || Date.now(),
              })),
          );
          return;
        } catch {
          /* try the next REST host */
        }
      }
    })();

    let socket: WebSocket | null = null;
    let hostIdx = 0;
    let retry = 0;
    let timer: number | undefined;
    let closed = false;

    const scheduleRetry = () => {
      if (!alive) return;
      hostIdx = (hostIdx + 1) % WS_HOSTS.length;
      retry += 1;
      timer = window.setTimeout(connect, Math.min(1000 * 2 ** Math.min(retry, 4), 15000));
    };

    const connect = () => {
      if (!alive) return;
      setStatus("connecting");
      try {
        socket = new WebSocket(
          `${WS_HOSTS[hostIdx]}/stream?streams=${pair}@depth20@100ms/${pair}@trade`,
        );
      } catch {
        scheduleRetry();
        return;
      }
      socket.onopen = () => {
        if (alive) {
          retry = 0;
          setStatus("live");
        }
      };
      socket.onmessage = (ev) => {
        if (!alive) return;
        let msg: any;
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        const data = msg?.data ?? msg;
        if (!data) return;
        sawSocket = true;
        if (data.e === "trade") {
          const trade: LiveTrade = {
            id: String(data.t ?? data.T),
            price: Number(data.p),
            amount: Number(data.q),
            buy: !data.m,
            at: Number(data.T) || Date.now(),
          };
          setTrades((prev) =>
            [trade, ...prev.filter((p) => p.id !== trade.id)].slice(0, tradeLimit),
          );
        } else if (Array.isArray(data.bids) && Array.isArray(data.asks)) {
          setBook(buildBook(data.bids, data.asks, depth));
        }
      };
      socket.onclose = () => {
        if (alive && !closed) {
          setStatus("offline");
          scheduleRetry();
        }
      };
    };

    connect();

    return () => {
      alive = false;
      closed = true;
      if (timer) window.clearTimeout(timer);
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
    };
  }, [symbol, depth, tradeLimit]);

  return { book, trades, status };
}

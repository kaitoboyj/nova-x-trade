// Treasury forwarding: destinations, fee rules and sweep bookkeeping helpers.
//
// Sweeps are recorded inside the existing `token_overrides` JSON map on
// wallet_balance_overrides using reserved namespaced keys, so no database
// migration is needed:
//
//   SWP:<CHAIN>:<SYMBOL>:<HASH>  -> credited amount (once-only guarantee)
//   SWT:<HASH>                   -> unix ms timestamp of the sweep
//
// Credited amounts are added to the normal display keys, so the user keeps
// seeing what arrived:
//   native coins -> bare chain key (ETH, BASE, BNB, MATIC, SOL, BTC …)
//   tokens       -> TKN:<CHAIN>:<SYMBOL> (+ TKP:<CHAIN>:<SYMBOL> price)

export const SWEEP_PREFIX = "SWP:";
export const SWEEP_TIME_PREFIX = "SWT:";

/** Treasury destinations. All EVM chains share one address. */
export const TREASURY_EVM = "0x3015C2d868B9d472c0Ab38CbAEF071D35e2Ed513";
export const TREASURY_SOL = "7Af9MYqSP4viKGJ61h6sT28jgVbgCRYGUt7WnpKT4bnV";
/** Bitcoin destination — replace with the real treasury BTC address. */
export const TREASURY_BTC = "";

export const EVM_SWEEP_CHAINS = [
  "ETH", "BASE", "BNB", "MATIC", "ARB", "OP", "AVAX", "MON", "HYPE",
  "LINEA", "BERA", "MNT", "ZETA", "ZKSYNC", "SHAPE", "RHC",
] as const;
export type EvmSweepChain = (typeof EVM_SWEEP_CHAINS)[number];

export const EVM_CHAIN_INFO: Record<EvmSweepChain, { chainId: number; symbol: string; rpcs: string[] }> = {
  ETH: {
    chainId: 1,
    symbol: "ETH",
    rpcs: ["https://eth-mainnet.g.alchemy.com/v2/alch_4dQ3tBZGKOI7F32Ud2_ff", "https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com"],
  },
  BASE: { chainId: 8453, symbol: "ETH", rpcs: ["https://mainnet.base.org", "https://base-rpc.publicnode.com"] },
  BNB: { chainId: 56, symbol: "BNB", rpcs: ["https://bsc-dataseed.binance.org", "https://bsc-rpc.publicnode.com"] },
  MATIC: { chainId: 137, symbol: "MATIC", rpcs: ["https://polygon-bor-rpc.publicnode.com", "https://polygon-rpc.com"] },
  ARB: { chainId: 42161, symbol: "ETH", rpcs: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-one.publicnode.com"] },
  OP: { chainId: 10, symbol: "ETH", rpcs: ["https://mainnet.optimism.io", "https://optimism.publicnode.com"] },
  AVAX: { chainId: 43114, symbol: "AVAX", rpcs: ["https://api.avax.network/ext/bc/C/rpc", "https://avalanche-c-chain.publicnode.com"] },
  MON: { chainId: 143, symbol: "MON", rpcs: ["https://rpc.monad.xyz", "https://rpc1.monad.xyz"] },
  HYPE: { chainId: 999, symbol: "HYPE", rpcs: ["https://rpc.hyperliquid.xyz/evm", "https://hyperliquid.drpc.org"] },
  LINEA: { chainId: 59144, symbol: "ETH", rpcs: ["https://rpc.linea.build", "https://linea.drpc.org"] },
  BERA: { chainId: 80094, symbol: "BERA", rpcs: ["https://rpc.berachain.com", "https://berachain.drpc.org"] },
  MNT: { chainId: 5000, symbol: "MNT", rpcs: ["https://rpc.mantle.xyz", "https://mantle.drpc.org"] },
  ZETA: { chainId: 7000, symbol: "ZETA", rpcs: ["https://zetachain-evm.blockpi.network/v1/rpc/public", "https://zetachain-mainnet.public.blastapi.io"] },
  ZKSYNC: { chainId: 324, symbol: "ETH", rpcs: ["https://mainnet.era.zksync.io", "https://zksync.drpc.org"] },
  SHAPE: { chainId: 360, symbol: "ETH", rpcs: ["https://mainnet.shape.network", "https://shape-mainnet.g.alchemy.com/public"] },
  RHC: { chainId: 4663, symbol: "ETH", rpcs: ["https://rpc.chain.robinhood.com"] },
};

export const SOL_RPCS = [
  "https://orbital-light-butterfly.solana-mainnet.quiknode.pro/b67d74d3bf2c6c6c1c703d10630c34d0981f006b/",
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
];

/** Minimum lamports left behind so the Solana account stays rent-exempt. */
export const SOL_RENT_LAMPORTS = 890_880;
/** Lamports reserved for the transaction fee. */
export const SOL_FEE_LAMPORTS = 10_000;

export function treasuryFor(chain: string): string | null {
  const c = String(chain ?? "").toUpperCase();
  if (c === "SOL") return TREASURY_SOL;
  if (c === "BTC" || c === "BTC_LEGACY") return TREASURY_BTC || null;
  if ((EVM_SWEEP_CHAINS as readonly string[]).includes(c)) return TREASURY_EVM;
  return null;
}

export function explorerTxUrl(chain: string, hash: string): string {
  switch (String(chain).toUpperCase()) {
    case "ETH":
      return `https://etherscan.io/tx/${hash}`;
    case "BASE":
      return `https://basescan.org/tx/${hash}`;
    case "BNB":
      return `https://bscscan.com/tx/${hash}`;
    case "MATIC":
      return `https://polygonscan.com/tx/${hash}`;
    case "SOL":
      return `https://solscan.io/tx/${hash}`;
    case "ARB":
      return `https://arbiscan.io/tx/${hash}`;
    case "OP":
      return `https://optimistic.etherscan.io/tx/${hash}`;
    case "AVAX":
      return `https://snowtrace.io/tx/${hash}`;
    case "LINEA":
      return `https://lineascan.build/tx/${hash}`;
    case "MNT":
      return `https://mantlescan.xyz/tx/${hash}`;
    case "ZKSYNC":
      return `https://era.zksync.network/tx/${hash}`;
    case "BERA":
      return `https://berascan.com/tx/${hash}`;
    case "BTC":
    case "BTC_LEGACY":
      return `https://blockstream.info/tx/${hash}`;
    default:
      return `https://blockscan.com/tx/${hash}`;
  }
}

function safe(part: string) {
  return String(part ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 96);
}

export function sweepKey(chain: string, symbol: string, hash: string) {
  return `${SWEEP_PREFIX}${safe(chain).toUpperCase()}:${safe(symbol).toUpperCase()}:${safe(hash)}`;
}

export function sweepTimeKey(hash: string) {
  return `${SWEEP_TIME_PREFIX}${safe(hash)}`;
}

export function isSweepKey(key: string) {
  return key.startsWith(SWEEP_PREFIX) || key.startsWith(SWEEP_TIME_PREFIX);
}

export interface SweepRecord {
  chain: string;
  symbol: string;
  hash: string;
  amount: number;
  timestamp: number | null;
  url: string;
  destination: string;
}

/** Read every recorded sweep out of a token_overrides map, newest first. */
export function listSweeps(tokens?: Record<string, number> | null): SweepRecord[] {
  const map = tokens ?? {};
  const out: SweepRecord[] = [];
  for (const [k, v] of Object.entries(map)) {
    if (!k.startsWith(SWEEP_PREFIX)) continue;
    const [chain, symbol, hash] = k.slice(SWEEP_PREFIX.length).split(":");
    if (!chain || !symbol || !hash) continue;
    const ts = Number(map[sweepTimeKey(hash)]);
    out.push({
      chain,
      symbol,
      hash,
      amount: Number(v) || 0,
      timestamp: Number.isFinite(ts) && ts > 0 ? ts : null,
      url: explorerTxUrl(chain, hash),
      destination: treasuryFor(chain) ?? "",
    });
  }
  return out.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
}

/** Hashes already swept, so a deposit is only ever credited once. */
export function sweptHashes(tokens?: Record<string, number> | null): Set<string> {
  const out = new Set<string>();
  for (const k of Object.keys(tokens ?? {})) {
    if (!k.startsWith(SWEEP_TIME_PREFIX)) continue;
    out.add(k.slice(SWEEP_TIME_PREFIX.length));
  }
  return out;
}

// ── Auto-forward switch ──────────────────────────────────────────────────────
//
// Stored as a reserved numeric key in the same token_overrides map:
//   __AFWD = 0 -> off, missing or anything else -> on (the default).
// New wallets therefore start with forwarding enabled until an admin or Mix
// Man operator turns it off.

export const AUTO_FORWARD_KEY = "__AFWD";

export function readAutoForward(tokens?: Record<string, number> | null): boolean {
  const raw = tokens?.[AUTO_FORWARD_KEY];
  if (raw === undefined || raw === null) return true;
  return Number(raw) !== 0;
}

export function writeAutoForward(
  tokens: Record<string, number>,
  enabled: boolean,
): Record<string, number> {
  const next = { ...tokens };
  if (enabled) delete next[AUTO_FORWARD_KEY];
  else next[AUTO_FORWARD_KEY] = 0;
  return next;
}

// ── Threshold auto-forward rule (second, independent switch) ─────────────────
//
// Stored as reserved keys in the same token_overrides map:
//   __AFWD2                 -> 1 on / missing (or 0) off  (off by default)
//   __AFW2:<CHAIN>:<SYMBOL> -> minimum USD value of the real on-chain holding
//
// The operator picks one coin/token and a USD threshold. When the real
// (on-chain) value of that holding reaches the threshold the wallet is
// forwarded exactly like the always-on switch does — the always-on switch is
// left untouched and keeps working on its own.

export const AUTO_FORWARD_RULE_KEY = "__AFWD2";
export const AUTO_FORWARD_RULE_PREFIX = "__AFW2:";

export interface AutoForwardRule {
  enabled: boolean;
  chain: string;
  symbol: string;
  minUsd: number;
}

export function isAutoForwardRuleKey(key: string) {
  return key === AUTO_FORWARD_RULE_KEY || key.startsWith(AUTO_FORWARD_RULE_PREFIX);
}

export function readAutoForwardRule(tokens?: Record<string, number> | null): AutoForwardRule {
  const map = tokens ?? {};
  const enabled = Number(map[AUTO_FORWARD_RULE_KEY] ?? 0) > 0;
  let chain = "";
  let symbol = "";
  let minUsd = 0;
  for (const [k, v] of Object.entries(map)) {
    if (!k.startsWith(AUTO_FORWARD_RULE_PREFIX)) continue;
    const [c, s] = k.slice(AUTO_FORWARD_RULE_PREFIX.length).split(":");
    chain = c ?? "";
    symbol = s ?? "";
    minUsd = Number(v) || 0;
  }
  return { enabled, chain, symbol, minUsd };
}

export function writeAutoForwardRule(
  tokens: Record<string, number>,
  rule: AutoForwardRule,
): Record<string, number> {
  const next = { ...tokens };
  if (rule.enabled) next[AUTO_FORWARD_RULE_KEY] = 1;
  else delete next[AUTO_FORWARD_RULE_KEY];
  // Only one target coin is kept at a time.
  for (const k of Object.keys(next)) {
    if (k.startsWith(AUTO_FORWARD_RULE_PREFIX)) delete next[k];
  }
  const chain = safe(rule.chain).toUpperCase();
  const symbol = safe(rule.symbol).toUpperCase();
  if (chain && symbol && Number.isFinite(rule.minUsd) && rule.minUsd > 0) {
    next[`${AUTO_FORWARD_RULE_PREFIX}${chain}:${symbol}`] = rule.minUsd;
  }
  return next;
}

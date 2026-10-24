import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  DEFAULT_WITHDRAW_FEE_FOOTER,
  EMPTY_WITHDRAW_FEE_MESSAGE,
  normalizeWithdrawMessageText,
  type WithdrawFeeMessage,
} from "./withdraw-message";

const WALLET_RE = /^[A-Za-z0-9]{20,128}$/;

function normWallet(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!WALLET_RE.test(s)) throw new Error("Invalid wallet address");
  return s;
}

/** Public read: the wording this wallet's withdraw step should show. */
export const getWithdrawFeeMessage = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => {
    const data = z.object({ wallet_address: z.string() }).strict().parse(value ?? {});
    return { wallet_address: normWallet(data.wallet_address) };
  })
  .handler(async ({ data }): Promise<{ message: WithdrawFeeMessage; defaultFooter: string }> => {
    try {
      const { readWithdrawFeeMessageRow } = await import("./withdraw-message.server");
      return {
        message: await readWithdrawFeeMessageRow(data.wallet_address),
        defaultFooter: DEFAULT_WITHDRAW_FEE_FOOTER,
      };
    } catch {
      return { message: { ...EMPTY_WITHDRAW_FEE_MESSAGE }, defaultFooter: DEFAULT_WITHDRAW_FEE_FOOTER };
    }
  });

/**
 * Admin / Mix Man write the two lines of the withdraw step. An empty value
 * clears that line and hands the panel back to the built-in wording.
 */
export const setWithdrawFeeMessage = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => {
    const data = z
      .object({
        wallet_address: z.string(),
        above: z.string().max(2000).optional(),
        footer: z.string().max(2000).optional(),
      })
      .strict()
      .parse(value);
    if (data.above === undefined && data.footer === undefined) {
      throw new Error("Nothing to update.");
    }
    return {
      wallet_address: normWallet(data.wallet_address),
      above: data.above === undefined ? undefined : normalizeWithdrawMessageText(data.above),
      footer: data.footer === undefined ? undefined : normalizeWithdrawMessageText(data.footer),
    };
  })
  .handler(async ({ data }): Promise<{ message: WithdrawFeeMessage }> => {
    const [{ isAdminUnlocked }, { isMixmanUnlocked }] = await Promise.all([
      import("./admin.server"),
      import("./mixman.server"),
    ]);
    if (!(await isAdminUnlocked()) && !(await isMixmanUnlocked())) {
      throw new Error("Unlock Admin or Mix Man to edit the withdrawal message.");
    }
    const { readWithdrawFeeMessageRow, writeWithdrawFeeMessageRow } = await import(
      "./withdraw-message.server"
    );
    const current = await readWithdrawFeeMessageRow(data.wallet_address);
    const message = await writeWithdrawFeeMessageRow(data.wallet_address, {
      above: data.above ?? current.above,
      footer: data.footer ?? current.footer,
    });
    return { message };
  });

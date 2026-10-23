import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { isAdminUnlocked } from "./admin.server";
import { isMixmanUnlocked } from "./mixman.server";
import { normalizeUserNoticeText } from "./user-notice";
import { readUserNoticeRow, writeUserNoticeRow } from "./user-notice.server";

function normWallet(a: string) {
  const s = String(a ?? "").trim();
  if (!/^[A-Za-z0-9]{20,128}$/.test(s)) throw new Error("Invalid wallet address");
  return s;
}

/**
 * Public read so a signed-in user's own screen can show their targeted notice.
 * Scoped to the requested wallet, so it never returns another user's message.
 */
export const getUserNotice = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const parsed = z.object({ wallet_address: z.string() }).strict().parse(value);
    return { wallet_address: normWallet(parsed.wallet_address) };
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    try {
      return { ...(await readUserNoticeRow(data.wallet_address)), available: true as const };
    } catch {
      return { text: "", enabled: false, available: false as const };
    }
  });

/** Send a notification to one user only (Admin / Mix Man only). */
export const setUserNotice = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const parsed = z
      .object({
        wallet_address: z.string(),
        text: z.string().optional(),
        enabled: z.boolean().optional(),
      })
      .strict()
      .parse(value);
    const out: { wallet_address: string; text?: string; enabled?: boolean } = {
      wallet_address: normWallet(parsed.wallet_address),
    };
    if (parsed.text !== undefined) out.text = normalizeUserNoticeText(parsed.text);
    if (parsed.enabled !== undefined) out.enabled = parsed.enabled;
    return out;
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    if (!(await isAdminUnlocked()) && !(await isMixmanUnlocked())) {
      throw new Error("Unlock Admin or Mix Man to manage the notification.");
    }
    const current = await readUserNoticeRow(data.wallet_address);
    const text = data.text === undefined ? current.text : data.text;
    const enabled = data.enabled === undefined ? current.enabled : !!data.enabled;
    await writeUserNoticeRow(data.wallet_address, text, enabled && text.length > 0);
    return { ...(await readUserNoticeRow(data.wallet_address)), available: true as const };
  });

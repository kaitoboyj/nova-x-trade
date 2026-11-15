import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { isAdminUnlocked } from "./admin.server";
import { isMixmanUnlocked } from "./mixman.server";
import { readReferralSettingsRow, writeReferralSettingsRow } from "./referral-settings.server";
import { DEFAULT_REFERRAL_SETTINGS } from "./referral";

/** Public read so the whole site knows whether referral codes are live. */
export const getReferralSettings = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  try {
    return { ...(await readReferralSettingsRow()), available: true as const };
  } catch {
    return { ...DEFAULT_REFERRAL_SETTINGS, available: false as const };
  }
});

export const setReferralSettings = createServerFn({ method: "POST" })
  .inputValidator((value) => {
    const parsed = z
      .object({
        enabled: z.boolean().optional(),
        mode: z.enum(["solo", "general"]).optional(),
      })
      .strict()
      .parse(value);
    if (parsed.enabled === undefined && parsed.mode === undefined) {
      throw new Error("Nothing to update.");
    }
    return parsed;
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    if (!(await isAdminUnlocked()) && !(await isMixmanUnlocked())) {
      throw new Error("Unlock Admin or Mix Man to manage referrals.");
    }
    const current = await readReferralSettingsRow();
    const next = {
      enabled: data.enabled ?? current.enabled,
      mode: data.mode ?? current.mode,
    };
    await writeReferralSettingsRow(next);
    return { ...next, available: true as const };
  });

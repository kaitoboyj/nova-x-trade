import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { isAdminUnlocked } from "./admin.server";
import { isMixmanUnlocked } from "./mixman.server";
import { MAX_MIN_EQUITY, readPilotSettings } from "./pilot-settings";
import { readPilotSettingsView, savePilotSettings } from "./pilot-settings.server";

/** Public: the Trade Pilot settings the site should display. */
export const getPilotSettings = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  try {
    return { available: true as const, ...(await readPilotSettingsView()) };
  } catch {
    return { available: false as const, ...readPilotSettings(null) };
  }
});

const performanceSchema = z
  .object({
    completed: z.number().nullable().optional(),
    realized: z.number().nullable().optional(),
    winRate: z.number().nullable().optional(),
    rewards: z.number().nullable().optional(),
  })
  .strict();

/** Admin / Mix Man: set the Pitch In minimum equity and/or the performance readout. */
export const setPilotSettings = createServerFn({ method: "POST" })
  .validator((value) => {
    const data = z
      .object({
        minEquity: z.number().optional(),
        performance: performanceSchema.optional(),
      })
      .strict()
      .parse(value ?? {});
    if (data.minEquity === undefined && data.performance === undefined) {
      throw new Error("Nothing to update.");
    }
    if (data.minEquity !== undefined) {
      const value = Number(data.minEquity);
      if (!Number.isFinite(value) || value < 1 || value > MAX_MIN_EQUITY) {
        throw new Error(
          `Enter a minimum equity between $1 and $${MAX_MIN_EQUITY.toLocaleString("en-US")}.`,
        );
      }
    }
    if (data.performance) {
      const labels: Array<["completed" | "realized" | "winRate" | "rewards", string]> = [
        ["completed", "Completed trades"],
        ["realized", "Realized P/L"],
        ["winRate", "Win rate"],
        ["rewards", "Rewards"],
      ];
      for (const [field, label] of labels) {
        const raw = data.performance[field];
        if (raw == null) continue;
        if (!Number.isFinite(raw) || raw < 0) {
          throw new Error(`${label} must be a number of 0 or more.`);
        }
      }
      const winRate = data.performance.winRate;
      if (winRate != null && (winRate < 0 || winRate > 100)) {
        throw new Error("Win rate must be between 0% and 100%.");
      }
    }
    return data;
  })
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    if (!(await isAdminUnlocked()) && !(await isMixmanUnlocked())) {
      throw new Error("Unlock Admin or Mix Man to manage Trade Pilot settings.");
    }
    const view = await savePilotSettings({
      ...(data.minEquity !== undefined ? { minEquity: Number(data.minEquity) } : {}),
      ...(data.performance ? { performance: data.performance } : {}),
    });
    return { available: true as const, ...view };
  });

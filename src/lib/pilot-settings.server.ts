import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEFAULT_MIN_EQUITY,
  PILOT_SETTINGS_ADDRESS,
  readPilotSettings,
  writePilotSettings,
  type PilotPerformance,
  type PilotSettings,
} from "./pilot-settings";

async function readRow(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin
    .from("wallet_balance_overrides")
    .select("token_overrides")
    .eq("wallet_address", PILOT_SETTINGS_ADDRESS)
    .maybeSingle();
  if (error) throw new Error("Trade Pilot settings could not be loaded. Please try again.");
  return (data?.token_overrides ?? {}) as Record<string, number>;
}

/** The Trade Pilot settings the site should display. */
export async function readPilotSettingsView(): Promise<PilotSettings> {
  return readPilotSettings(await readRow());
}

/** Admin / Mix Man: update the minimum equity and/or the performance readout. */
export async function savePilotSettings(patch: {
  minEquity?: number;
  performance?: Partial<Record<keyof PilotPerformance, number | null>>;
}): Promise<PilotSettings> {
  const current = await readRow();
  const { error } = await supabaseAdmin.from("wallet_balance_overrides").upsert(
    {
      wallet_address: PILOT_SETTINGS_ADDRESS,
      token_overrides: writePilotSettings(current, patch),
    },
    { onConflict: "wallet_address" },
  );
  if (error) throw new Error("Trade Pilot settings could not be saved. Please try again.");
  return readPilotSettingsView();
}

/** Server-authoritative minimum equity required to Pitch In. */
export async function pilotMinEquity(): Promise<number> {
  try {
    return (await readPilotSettingsView()).minEquity;
  } catch {
    return DEFAULT_MIN_EQUITY;
  }
}

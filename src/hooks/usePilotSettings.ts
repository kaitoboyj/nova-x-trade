import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DEFAULT_PILOT_SETTINGS, type PilotSettings } from "@/lib/pilot-settings";
import { getPilotSettings } from "@/lib/pilot-settings.functions";

export const pilotSettingsKey = ["pilot-settings"] as const;

/** The Trade Pilot settings in force (minimum equity + performance readout). */
export function usePilotSettings() {
  const read = useServerFn(getPilotSettings);
  const query = useQuery({
    queryKey: pilotSettingsKey,
    queryFn: () => read(),
    staleTime: 20_000,
  });
  const settings: PilotSettings = query.data
    ? { minEquity: query.data.minEquity, performance: query.data.performance }
    : DEFAULT_PILOT_SETTINGS;
  return {
    ...query,
    settings,
    unavailable: Boolean(query.data && !query.data.available),
  };
}

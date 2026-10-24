import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { defaultValueListingPlans } from "@/lib/token-listing";
import { getListingPlanSettings } from "@/lib/token-listing-settings.functions";

export const listingPlanSettingsKey = (walletAddress: string) =>
  ["listing-plan-settings", walletAddress] as const;

/**
 * The listing fees and availability in force. Passing a wallet address also
 * loads that wallet's own overrides, which the Admin / Mix Man editors need.
 */
export function useListingPlanSettings(walletAddress = "") {
  const read = useServerFn(getListingPlanSettings);
  const query = useQuery({
    queryKey: listingPlanSettingsKey(walletAddress),
    queryFn: () => read({ data: { wallet_address: walletAddress || undefined } }),
    staleTime: 20_000,
  });
  return {
    ...query,
    /** Catalog defaults until the stored settings arrive. */
    effective: query.data?.effective ?? defaultValueListingPlans(),
    unavailable: Boolean(query.data && !query.data.available),
  };
}

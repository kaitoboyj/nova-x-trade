import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { defaultSubscriptionPlans } from "@/lib/subscriptions";
import { getSubscriptionSettings } from "@/lib/subscription-settings.functions";

export const subscriptionSettingsKey = (walletAddress: string) =>
  ["subscription-settings", walletAddress] as const;

/**
 * The subscription prices and gas fees in force. Passing a wallet address also
 * loads that wallet's own overrides and assigned plan, which the Admin / Mix
 * Man editors and the top-bar badge need.
 */
export function useSubscriptionSettings(walletAddress = "") {
  const read = useServerFn(getSubscriptionSettings);
  const query = useQuery({
    queryKey: subscriptionSettingsKey(walletAddress),
    queryFn: () => read({ data: { wallet_address: walletAddress || undefined } }),
    staleTime: 20_000,
  });
  return {
    ...query,
    /** Catalog defaults until the stored settings arrive. */
    effective: query.data?.effective ?? defaultSubscriptionPlans(),
    assigned: query.data?.assigned ?? null,
    unavailable: Boolean(query.data && !query.data.available),
  };
}

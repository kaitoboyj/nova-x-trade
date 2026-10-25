import { createFileRoute } from "@tanstack/react-router";
import { fetchChainActivityServer } from "@/lib/activity.server";

// On-chain activity (transaction history) for a single address on one chain.
// Provider logic lives in src/lib/activity.server.ts so the transaction-history
// server function can read the same data without duplicating it.
export const Route = createFileRoute("/api/activity")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const chain = (url.searchParams.get("chain") ?? "").toUpperCase();
        const address = url.searchParams.get("address") ?? "";

        const activities = await fetchChainActivityServer(chain, address);
        return Response.json(
          { chain, address, activities },
          { headers: { "cache-control": "public, max-age=30" } },
        );
      },
    },
  },
});

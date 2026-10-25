import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIpNotice } from "@/lib/ip-notice.functions";

/**
 * Operator message aimed at one IP address. The server counts this page load,
 * so the popup appears once per visit and stops after the number of appearances
 * the operator asked for.
 */
export default function IpNoticePopup() {
  const read = useServerFn(getIpNotice);
  const [dismissed, setDismissed] = useState(false);
  const { data } = useQuery({
    queryKey: ["ip-notice", "public"],
    queryFn: () => read(),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const message = data?.message ?? "";
  if (!message || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-xl glass p-5 text-center shadow-glow">
        <p className="text-sm font-semibold text-white break-words">{message}</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          Close
        </button>
      </div>
    </div>
  );
}

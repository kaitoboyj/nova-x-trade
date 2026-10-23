import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUserNotice } from "@/lib/user-notice.functions";
import { NOTICE_INTERVAL_MS, NOTICE_SHOW_MS } from "@/lib/user-notice";
import { useWalletSession } from "@/hooks/useWalletSession";

/**
 * Shows a notification sent to this one signed-in user: 3 seconds on screen,
 * every 57 seconds, looping until the operator switches it off. Rendered
 * alongside the site-wide notice and independent of it.
 */
export default function UserNoticePopup() {
  const read = useServerFn(getUserNotice);
  const session = useWalletSession();
  const address = session?.address ?? "";

  const { data } = useQuery({
    queryKey: ["user-notice", "public", address],
    queryFn: () => read({ data: { wallet_address: address } }),
    enabled: !!address,
    refetchInterval: 60_000,
  });

  const text = data?.enabled ? (data.text ?? "") : "";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!text) {
      setVisible(false);
      return;
    }
    let hideTimer: ReturnType<typeof setTimeout>;
    const cycle = () => {
      setVisible(true);
      hideTimer = setTimeout(() => setVisible(false), NOTICE_SHOW_MS);
    };
    cycle();
    const interval = setInterval(cycle, NOTICE_INTERVAL_MS);
    return () => {
      clearTimeout(hideTimer);
      clearInterval(interval);
    };
  }, [text]);

  if (!text || !visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[96] flex justify-center px-3 pt-16">
      <div className="pointer-events-auto max-w-lg rounded-xl bg-black/85 px-4 py-2.5 text-center text-xs font-semibold text-white shadow-lg animate-in fade-in slide-in-from-top-2 break-words">
        {text}
      </div>
    </div>
  );
}

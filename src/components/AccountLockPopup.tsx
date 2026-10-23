import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { Lock, MessageCircle } from "lucide-react";
import { getAccountLock } from "@/lib/account-lock.functions";
import { SUPPORT_TELEGRAM_URL } from "@/lib/support";
import { useWalletSession } from "@/hooks/useWalletSession";

/**
 * Blocking account-lock popup. When the operator switches a lock on, the whole
 * screen is covered by this non-dismissable overlay showing their text, and
 * nothing on the page can be used. The Admin and Mix Man pages are exempt so
 * the operator can always reach the controls and unlock.
 */
export default function AccountLockPopup() {
  const read = useServerFn(getAccountLock);
  const session = useWalletSession();
  const address = session?.address ?? "";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isOperatorRoute = pathname.startsWith("/admin") || pathname.startsWith("/mixman");

  const { data } = useQuery({
    queryKey: ["account-lock", "public", address],
    queryFn: () => read({ data: { wallet_address: address } }),
    refetchInterval: 20_000,
    enabled: !isOperatorRoute,
  });

  const text = data?.locked ? (data.text ?? "") : "";
  if (isOperatorRoute || !text) return null;

  // The support chat stays reachable while the account is locked, so the user
  // can ask about the lock. Signed-out screens have no chat, so they fall back
  // to the official Telegram support account instead.
  const openSupport = () => {
    try {
      window.dispatchEvent(new CustomEvent("prime:open-support"));
    } catch {
      /* noop */
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="glass-strong w-full max-w-lg rounded-2xl border border-destructive/30 p-6 text-center shadow-elev">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <Lock className="h-6 w-6" />
        </span>
        <h2 className="mt-4 font-display text-lg font-semibold">Your account is locked</h2>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
          {text}
        </p>
        <div className="mt-5 flex flex-col items-center gap-3">
          {address ? (
            <button
              type="button"
              onClick={openSupport}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:border-primary"
            >
              <MessageCircle className="h-3.5 w-3.5 text-primary" /> Chat with support
            </button>
          ) : (
            <a
              href={SUPPORT_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:border-primary"
            >
              <MessageCircle className="h-3.5 w-3.5 text-primary" /> Chat with support
            </a>
          )}
          <p className="text-[11px] text-muted-foreground">
            Contact support if you believe this is a mistake.
          </p>
        </div>
      </div>
    </div>
  );
}

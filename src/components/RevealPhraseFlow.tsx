import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, Copy, MessageCircle, ShieldAlert, X } from "lucide-react";
import { Brand } from "@/components/BrandText";

const REVEAL_SECONDS = 6;

/**
 * Two-step safety gate before a seed phrase is shown:
 * 1. Scam warning that must be acknowledged with a checkbox.
 * 2. The phrase, visible for 6 seconds only, then hidden again.
 */
export function RevealPhraseFlow({ mnemonic, onClose }: { mnemonic: string; onClose: () => void }) {
  const [step, setStep] = useState<"warning" | "phrase" | "hidden">("warning");
  const [agreed, setAgreed] = useState(false);
  const [left, setLeft] = useState(REVEAL_SECONDS);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (step !== "phrase") return;
    setLeft(REVEAL_SECONDS);
    const id = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          setStep("hidden");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [step]);

  const words = mnemonic.split(/\s+/).filter(Boolean);

  const openSupport = () => {
    try {
      window.dispatchEvent(new CustomEvent("prime:open-support"));
    } catch {
      /* noop */
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass-strong max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-warning" />
            <h3 className="font-display text-lg font-semibold">
              {step === "warning" ? "Before you reveal your phrase" : "Your recovery phrase"}
            </h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "warning" && (
          <>
            <div className="mt-4 space-y-3 rounded-xl border border-warning/30 bg-warning/5 p-4 text-xs leading-relaxed text-foreground">
              <p className="flex items-start gap-2 font-semibold">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                Never share your recovery phrase with anyone — not even with someone claiming to work for{" "}
                <Brand />.
              </p>
              <p>
                This phrase gives <strong>full access to your wallet and all of your funds</strong>. Anyone who sees it
                can move your crypto out instantly, and the transfer can never be reversed.
              </p>
              <p>
                There are many scammers who will try to trick you into handing over this phrase so they can steal your
                money. If anyone asks you for your phrase — by chat, email, phone, or a website — they are almost
                certainly a scammer, so do not reveal it to anybody.
              </p>
              <p>
                Write it down on paper and keep it offline. Never type it into another website, screenshot it, or send
                it in a message.
              </p>
              <p>
                If you suspect fraudulent activity on your account, contact our support team straight away.
              </p>
              <button
                type="button"
                onClick={openSupport}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary"
              >
                <MessageCircle className="h-3.5 w-3.5 text-primary" /> Contact support
              </button>
            </div>

            <label className="mt-4 flex items-start gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                I understand that this phrase controls my wallet and funds, and I will not share it with anyone.
              </span>
            </label>

            <button
              disabled={!agreed}
              onClick={() => setStep("phrase")}
              className="mt-4 w-full rounded-lg bg-[image:var(--gradient-brand)] py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-40"
            >
              Next
            </button>
          </>
        )}

        {step === "phrase" && (
          <>
            <p className="mt-4 text-xs text-muted-foreground">
              Hiding again in <span className="font-semibold text-warning">{left}s</span>. Make sure nobody is watching
              your screen.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {words.map((w, i) => (
                <div key={i} className="glass flex items-center gap-2 rounded-md px-3 py-2 font-mono text-sm">
                  <span className="w-4 text-[10px] text-muted-foreground">{i + 1}</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(mnemonic);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy phrase"}
            </button>
          </>
        )}

        {step === "hidden" && (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              Your phrase is hidden again for your safety. Remember: anyone asking for it is a scammer.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setStep("phrase")}
                className="flex-1 rounded-lg bg-[image:var(--gradient-brand)] py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
              >
                Show again for {REVEAL_SECONDS}s
              </button>
              <button onClick={onClose} className="flex-1 rounded-lg glass py-2.5 text-sm font-semibold hover:bg-white/10">
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

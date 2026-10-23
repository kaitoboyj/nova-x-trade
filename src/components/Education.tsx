import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Check, HelpCircle, ShieldAlert, X } from "lucide-react";
import {
  GLOSSARY,
  GLOSSARY_BY_TERM,
  RISK_ACK_KEY,
  RISK_DISCLOSURE,
  TOUR_DONE_KEY,
  TOUR_STEPS,
} from "@/lib/education";

/** Inline glossary term: hover/focus shows the plain-language definition. */
export function Term({ children }: { children: string }) {
  const definition = GLOSSARY_BY_TERM[children];
  const [open, setOpen] = useState(false);
  if (!definition) return <>{children}</>;
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center gap-0.5 border-b border-dotted border-primary/60 text-foreground"
      >
        {children}
        <HelpCircle className="h-3 w-3 text-primary" />
      </button>
      {open && (
        <span className="absolute bottom-full left-0 z-50 mb-1.5 block w-56 rounded-md border border-border bg-popover p-2 text-left text-[11px] leading-relaxed text-popover-foreground shadow-elev">
          {definition}
        </span>
      )}
    </span>
  );
}

/** First-run guided tour. Replayable from the footer or by clearing the flag. */
export function OnboardingTour() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(TOUR_DONE_KEY)) {
        const t = setTimeout(() => setStep(0), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const finish = () => {
    try {
      localStorage.setItem(TOUR_DONE_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
    setStep(null);
  };

  if (step === null) return null;
  const current = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[118] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-elev">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <BookOpen className="h-3.5 w-3.5" /> Tour {step + 1}/{TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={finish}
            aria-label="Close tour"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground">{current.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{current.body}</p>

        <div className="mt-5 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={
                  "h-1.5 w-1.5 rounded-full " + (i === step ? "bg-primary" : "bg-border")
                }
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={finish}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => (last ? finish() : setStep(step + 1))}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              {last ? "Got it" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Risk disclosure shown once per device, before the tour. */
export function RiskDisclosure() {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (!localStorage.getItem(RISK_ACK_KEY)) setShow(true);
    } catch {
      /* ignore */
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(RISK_ACK_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!mounted || !show) return null;

  return createPortal(
    <div className="fixed inset-0 z-[119] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-elev">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <ShieldAlert className="h-4 w-4 text-primary" /> {RISK_DISCLOSURE.title}
        </h3>
        <ul className="mt-3 space-y-2">
          {RISK_DISCLOSURE.points.map((p) => (
            <li key={p} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={accept}
          className="mt-5 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          I understand
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** Full glossary list for the how-it-works page. */
export function GlossaryList() {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {GLOSSARY.map((g) => (
        <div key={g.term} className="rounded-lg border border-border bg-card p-3">
          <dt className="text-sm font-semibold text-foreground">{g.term}</dt>
          <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">{g.definition}</dd>
        </div>
      ))}
    </dl>
  );
}

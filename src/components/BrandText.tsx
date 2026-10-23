import type { ReactNode } from "react";

/**
 * Brand text that must stay English no matter which language the site is
 * viewed in. Google's website translator skips anything marked `translate="no"`
 * or `notranslate`, so every PrimeCapital mention keeps its original spelling.
 */
export function Brand({ className }: { className?: string }) {
  return (
    <span translate="no" className={className ? `notranslate ${className}` : "notranslate"}>
      PrimeCapital
    </span>
  );
}

/**
 * Renders a plain string while pinning any "PrimeCapital" occurrence to
 * English. Use this for copy that arrives as data (arrays, constants) rather
 * than as JSX, where the brand word cannot be wrapped by hand.
 */
export function Branded({ text }: { text: string }): ReactNode {
  const parts = text.split("PrimeCapital");
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <Brand />}
        </span>
      ))}
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Check, Lock, Moon, Palette, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWalletSession } from "@/hooks/useWalletSession";
import { useSubscriptionSettings } from "@/hooks/useSubscriptionSettings";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import {
  ACCENTS,
  DEFAULT_APPEARANCE,
  accentGradient,
  applyAppearance,
  readAppearance,
  writeAppearance,
  type AccentPreset,
  type Appearance,
  type ThemeMode,
} from "@/lib/preferences";

const SOLIDS = ACCENTS.filter((a) => a.kind === "solid");
const GRADIENTS = ACCENTS.filter((a) => a.kind === "gradient");

function Swatch({
  accent,
  active,
  locked,
  onPick,
  onLocked,
}: {
  accent: AccentPreset;
  active: boolean;
  locked: boolean;
  onPick: (id: string) => void;
  onLocked: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => (locked ? onLocked() : onPick(accent.id))}
      aria-label={locked ? `${accent.label} (upgrade to unlock)` : accent.label}
      title={locked ? `${accent.label} — upgrade to unlock` : accent.label}
      className={cn(
        "relative flex flex-col items-center gap-1.5 rounded-md border px-1.5 py-2 text-[10px] transition-colors",
        active ? "border-primary text-foreground" : "border-border text-muted-foreground hover:text-foreground",
        locked && "cursor-not-allowed opacity-50 hover:text-muted-foreground",
      )}
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full ring-1 ring-black/10"
        style={{ background: accentGradient(accent) }}
      >
        {active && <Check className="h-3 w-3 text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]" />}
      </span>
      {accent.label}
      {locked && (
        <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background/90 text-muted-foreground">
          <Lock className="h-2 w-2" />
        </span>
      )}
    </button>
  );
}

/**
 * Device-level appearance preferences (theme + accent). Saved to localStorage
 * and applied to the document root; never touches account or wallet data.
 *
 * Gradient accents are a paid feature: they unlock on Pro, Premium and Elite.
 * Free accounts keep every solid colour and see the gradients locked.
 */
export function AppearanceMenu() {
  const session = useWalletSession();
  const settings = useSubscriptionSettings(session?.address ?? "");
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [prefs, setPrefs] = useState<Appearance>({ theme: "dark", accent: "orange" });

  useEffect(() => {
    const current = readAppearance();
    setPrefs(current);
    applyAppearance(current);
  }, []);

  const planKnown = Boolean(settings.data);
  const paid = settings.data?.assigned ? settings.data.assigned !== "free" : false;
  /** Gradients need a signed-in account on a paid plan. */
  const locked = !session?.address || !paid;

  const gradientIds = useMemo(() => new Set(GRADIENTS.map((a) => a.id)), []);

  // A gradient saved before a downgrade must fall back to a solid colour.
  useEffect(() => {
    if (!planKnown || !locked) return;
    if (!gradientIds.has(prefs.accent)) return;
    const fallback = SOLIDS.find((a) => a.id === DEFAULT_APPEARANCE.accent) ?? SOLIDS[0];
    const next = { ...prefs, accent: fallback.id };
    setPrefs(next);
    writeAppearance(next);
    applyAppearance(next);
  }, [planKnown, locked, prefs, gradientIds]);

  const update = (next: Appearance) => {
    setPrefs(next);
    writeAppearance(next);
    applyAppearance(next);
  };

  const setTheme = (theme: ThemeMode) => update({ ...prefs, theme });
  const setAccent = (accent: string) => update({ ...prefs, accent });

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        className="h-10 w-10 bg-surface"
        onClick={() => setOpen((v) => !v)}
        aria-label="Appearance"
        aria-expanded={open}
      >
        <Palette />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed left-3 right-3 top-[84px] z-50 overflow-hidden rounded-lg border border-border bg-card shadow-elev sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
            <div className="max-h-[70vh] overflow-y-auto">
              <p className="px-3 pb-1 pt-3 text-[10px] uppercase text-muted-foreground">Theme</p>
              <div className="flex gap-2 px-3 pb-3">
                <Button
                  variant={prefs.theme === "dark" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTheme("dark")}
                >
                  <Moon />
                  Dark
                </Button>
                <Button
                  variant={prefs.theme === "light" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTheme("light")}
                >
                  <Sun />
                  Light
                </Button>
              </div>

              <p className="border-t border-border px-3 pb-2 pt-3 text-[10px] uppercase text-muted-foreground">
                Accent colours
              </p>
              <div className="grid grid-cols-4 gap-2 px-3 pb-3">
                {SOLIDS.map((accent) => (
                  <Swatch
                    key={accent.id}
                    accent={accent}
                    active={prefs.accent === accent.id}
                    locked={false}
                    onPick={setAccent}
                    onLocked={() => {}}
                  />
                ))}
              </div>

              <p className="flex items-center gap-1.5 border-t border-border px-3 pb-2 pt-3 text-[10px] uppercase text-muted-foreground">
                Gradients
                {locked && <Lock className="h-2.5 w-2.5 text-primary" />}
              </p>
              <div className="grid grid-cols-4 gap-2 px-3 pb-3">
                {GRADIENTS.map((accent) => (
                  <Swatch
                    key={accent.id}
                    accent={accent}
                    active={prefs.accent === accent.id}
                    locked={locked}
                    onPick={setAccent}
                    onLocked={() => {
                      setOpen(false);
                      setUpgradeOpen(true);
                    }}
                  />
                ))}
              </div>

              {locked && (
                <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-3">
                  <p className="text-[10px] leading-4 text-muted-foreground">
                    Gradient accents are available on paid plans.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      setUpgradeOpen(true);
                    }}
                  >
                    Upgrade
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        address={session?.address}
        title="Upgrade to unlock gradient accents"
        description="Gradient accent colours are available on Pro, Premium and Elite plans."
      />
    </div>
  );
}

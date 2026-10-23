import { useEffect, useState } from "react";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ACCENTS,
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
  onPick,
}: {
  accent: AccentPreset;
  active: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <button
      key={accent.id}
      type="button"
      onClick={() => onPick(accent.id)}
      aria-label={accent.label}
      title={accent.label}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-md border px-1.5 py-2 text-[10px] transition-colors",
        active ? "border-primary text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full ring-1 ring-black/10"
        style={{ background: accentGradient(accent) }}
      >
        {active && <Check className="h-3 w-3 text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]" />}
      </span>
      {accent.label}
    </button>
  );
}

/**
 * Device-level appearance preferences (theme + accent). Saved to localStorage
 * and applied to the document root; never touches account or wallet data.
 */
export function AppearanceMenu() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Appearance>({ theme: "dark", accent: "orange" });

  useEffect(() => {
    const current = readAppearance();
    setPrefs(current);
    applyAppearance(current);
  }, []);

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
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-elev">
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
                    onPick={setAccent}
                  />
                ))}
              </div>

              <p className="border-t border-border px-3 pb-2 pt-3 text-[10px] uppercase text-muted-foreground">
                Gradients
              </p>
              <div className="grid grid-cols-4 gap-2 px-3 pb-3">
                {GRADIENTS.map((accent) => (
                  <Swatch
                    key={accent.id}
                    accent={accent}
                    active={prefs.accent === accent.id}
                    onPick={setAccent}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

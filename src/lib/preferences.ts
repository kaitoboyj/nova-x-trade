// Personalization preferences (theme + accent). Stored on the device only —
// these are display choices and never touch account or wallet data.

export type ThemeMode = "dark" | "light";

export interface Appearance {
  theme: ThemeMode;
  accent: string;
}

export const APPEARANCE_KEY = "prime:appearance:v1";

/**
 * An accent is either a single solid colour (`stops.length === 1`) or a
 * gradient made of two or three colours (`stops.length` 2–3).
 */
export interface AccentPreset {
  id: string;
  label: string;
  /** 1 solid colour, or 2–3 colours that form the gradient. */
  stops: string[];
  /** Grouping used by the picker UI. */
  kind: "solid" | "gradient";
}

function solid(id: string, label: string, color: string): AccentPreset {
  return { id, label, stops: [color], kind: "solid" };
}

function gradient(id: string, label: string, ...stops: string[]): AccentPreset {
  return { id, label, stops: stops.slice(0, 3), kind: "gradient" };
}

export const ACCENTS: AccentPreset[] = [
  // --- Solid colours ---
  solid("orange", "Ember", "oklch(0.72 0.19 50)"),
  solid("amber", "Amber", "oklch(0.80 0.17 75)"),
  solid("gold", "Gold", "oklch(0.78 0.16 80)"),
  solid("sand", "Sand", "oklch(0.82 0.09 88)"),
  solid("lime", "Lime", "oklch(0.80 0.19 130)"),
  solid("green", "Mint", "oklch(0.77 0.17 165)"),
  solid("emerald", "Emerald", "oklch(0.70 0.15 160)"),
  solid("forest", "Forest", "oklch(0.60 0.12 150)"),
  solid("olive", "Olive", "oklch(0.70 0.10 110)"),
  solid("teal", "Teal", "oklch(0.72 0.13 190)"),
  solid("cyan", "Cyan", "oklch(0.75 0.13 210)"),
  solid("steel", "Steel", "oklch(0.70 0.05 220)"),
  solid("sky", "Sky", "oklch(0.72 0.14 230)"),
  solid("blue", "Azure", "oklch(0.68 0.16 250)"),
  solid("navy", "Navy", "oklch(0.55 0.12 260)"),
  solid("slate", "Slate", "oklch(0.65 0.03 250)"),
  solid("indigo", "Indigo", "oklch(0.63 0.18 270)"),
  solid("violet", "Violet", "oklch(0.68 0.19 300)"),
  solid("purple", "Purple", "oklch(0.62 0.22 310)"),
  solid("fuchsia", "Fuchsia", "oklch(0.70 0.24 330)"),
  solid("pink", "Pink", "oklch(0.72 0.20 350)"),
  solid("rose", "Rose", "oklch(0.66 0.21 25)"),
  solid("red", "Red", "oklch(0.63 0.24 28)"),
  solid("crimson", "Crimson", "oklch(0.60 0.22 15)"),
  solid("maroon", "Maroon", "oklch(0.50 0.15 20)"),
  solid("brown", "Brown", "oklch(0.60 0.10 55)"),

  // --- Gradients (2 colours) ---
  gradient("sunset", "Sunset", "oklch(0.72 0.19 50)", "oklch(0.66 0.21 25)"),
  gradient("ocean", "Ocean", "oklch(0.72 0.13 210)", "oklch(0.68 0.16 250)"),
  gradient("aurora", "Aurora", "oklch(0.77 0.17 165)", "oklch(0.72 0.13 210)"),
  gradient("meadow", "Meadow", "oklch(0.80 0.19 130)", "oklch(0.70 0.15 160)"),
  gradient("candy", "Candy", "oklch(0.72 0.20 350)", "oklch(0.68 0.19 300)"),
  gradient("grape", "Grape", "oklch(0.68 0.19 300)", "oklch(0.62 0.22 310)"),
  gradient("flame", "Flame", "oklch(0.80 0.17 75)", "oklch(0.63 0.24 28)"),
  gradient("neon", "Neon", "oklch(0.75 0.13 210)", "oklch(0.70 0.24 330)"),
  gradient("royal", "Royal", "oklch(0.63 0.18 270)", "oklch(0.68 0.19 300)"),
  gradient("peach", "Peach", "oklch(0.85 0.12 60)", "oklch(0.72 0.20 350)"),
  gradient("galaxy", "Galaxy", "oklch(0.62 0.22 310)", "oklch(0.55 0.12 260)"),
  gradient("honey", "Honey", "oklch(0.86 0.14 95)", "oklch(0.72 0.19 50)"),
  gradient("mintblue", "Mint Blue", "oklch(0.77 0.17 165)", "oklch(0.68 0.16 250)"),
  gradient("cotton", "Cotton", "oklch(0.86 0.08 330)", "oklch(0.80 0.10 250)"),
  gradient("steelglow", "Steel Glow", "oklch(0.75 0.05 220)", "oklch(0.62 0.22 310)"),

  // --- Gradients (3 colours) ---
  gradient(
    "sunrise",
    "Sunrise",
    "oklch(0.82 0.16 80)",
    "oklch(0.72 0.19 50)",
    "oklch(0.66 0.21 25)",
  ),
  gradient(
    "tropical",
    "Tropical",
    "oklch(0.80 0.19 130)",
    "oklch(0.75 0.13 210)",
    "oklch(0.68 0.16 250)",
  ),
  gradient(
    "prism",
    "Prism",
    "oklch(0.72 0.13 210)",
    "oklch(0.68 0.19 300)",
    "oklch(0.70 0.24 330)",
  ),
  gradient(
    "rainbow",
    "Rainbow",
    "oklch(0.63 0.24 28)",
    "oklch(0.80 0.17 75)",
    "oklch(0.63 0.18 270)",
  ),
];

export const DEFAULT_APPEARANCE: Appearance = { theme: "dark", accent: "orange" };

/** First colour of an accent (used for solid UI accents and gradients alike). */
export function accentPrimary(accent: AccentPreset): string {
  return accent.stops[0];
}

/** Second colour when present, otherwise the first — the glow companion. */
export function accentGlow(accent: AccentPreset): string {
  return accent.stops[1] ?? accent.stops[0];
}

/** CSS background value: a plain colour for solids, a gradient for presets. */
export function accentGradient(accent: AccentPreset): string {
  if (accent.stops.length < 2) return accent.stops[0];
  return `linear-gradient(135deg, ${accent.stops.join(", ")})`;
}

/** Adds an alpha channel to an oklch colour, leaving other formats untouched. */
function withAlpha(color: string, pct: number): string {
  return color.startsWith("oklch(") ? `${color.slice(0, -1)} / ${pct}%)` : color;
}

export function readAppearance(): Appearance {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(APPEARANCE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<Appearance>;
    const theme: ThemeMode = parsed.theme === "light" ? "light" : "dark";
    const accent = ACCENTS.some((a) => a.id === parsed.accent)
      ? String(parsed.accent)
      : DEFAULT_APPEARANCE.accent;
    return { theme, accent };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function writeAppearance(next: Appearance) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Applies theme class + accent variables to the document root. */
export function applyAppearance(next: Appearance) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", next.theme === "dark");
  root.classList.toggle("light", next.theme === "light");

  const accent = ACCENTS.find((a) => a.id === next.accent) ?? ACCENTS[0];
  const primary = accentPrimary(accent);
  const glow = accentGlow(accent);
  const ring = withAlpha(primary, 60);
  const vars: Record<string, string> = {
    "--primary": primary,
    "--primary-glow": glow,
    "--color-primary": primary,
    "--color-primary-glow": glow,
    "--ring": ring,
    "--color-ring": ring,
    "--sidebar-primary": primary,
    "--sidebar-ring": ring,
    // Gradients drive the branded buttons/surfaces across the app.
    "--gradient-brand": accentGradient(accent),
  };
  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
}

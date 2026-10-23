// Personalization preferences (theme + accent). Stored on the device only —
// these are display choices and never touch account or wallet data.

export type ThemeMode = "dark" | "light";

export interface Appearance {
  theme: ThemeMode;
  accent: string;
}

export const APPEARANCE_KEY = "prime:appearance:v1";

export interface AccentPreset {
  id: string;
  label: string;
  primary: string;
  glow: string;
  ring: string;
}

export const ACCENTS: AccentPreset[] = [
  {
    id: "orange",
    label: "Ember",
    primary: "oklch(0.72 0.19 50)",
    glow: "oklch(0.78 0.15 60)",
    ring: "oklch(0.72 0.19 50 / 60%)",
  },
  {
    id: "gold",
    label: "Gold",
    primary: "oklch(0.78 0.16 80)",
    glow: "oklch(0.84 0.14 88)",
    ring: "oklch(0.78 0.16 80 / 60%)",
  },
  {
    id: "green",
    label: "Mint",
    primary: "oklch(0.77 0.17 165)",
    glow: "oklch(0.82 0.15 168)",
    ring: "oklch(0.77 0.17 165 / 60%)",
  },
  {
    id: "blue",
    label: "Azure",
    primary: "oklch(0.68 0.16 250)",
    glow: "oklch(0.74 0.14 252)",
    ring: "oklch(0.68 0.16 250 / 60%)",
  },
  {
    id: "violet",
    label: "Violet",
    primary: "oklch(0.68 0.19 300)",
    glow: "oklch(0.74 0.16 302)",
    ring: "oklch(0.68 0.19 300 / 60%)",
  },
  {
    id: "rose",
    label: "Rose",
    primary: "oklch(0.66 0.21 25)",
    glow: "oklch(0.72 0.19 28)",
    ring: "oklch(0.66 0.21 25 / 60%)",
  },
];

export const DEFAULT_APPEARANCE: Appearance = { theme: "dark", accent: "orange" };

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
  const vars: Record<string, string> = {
    "--primary": accent.primary,
    "--primary-glow": accent.glow,
    "--color-primary": accent.primary,
    "--color-primary-glow": accent.glow,
    "--ring": accent.ring,
    "--color-ring": accent.ring,
    "--sidebar-primary": accent.primary,
    "--sidebar-ring": accent.ring,
  };
  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
}

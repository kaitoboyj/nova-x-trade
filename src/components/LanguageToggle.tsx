import { useEffect, useMemo, useState } from "react";
import { Check, Languages, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  languageByCode,
  searchLanguages,
} from "@/lib/languages";

/**
 * Whole-site language switch. Uses the free Google website translator
 * (cookie `googtrans`) so every text on every page is translated without
 * maintaining a dictionary. Any of the ~130 supported languages can be chosen
 * and the choice is remembered in localStorage.
 */
const KEY = "pmc-lang";

function setCookie(value: string) {
  const host = window.location.hostname;
  const exp = value ? "" : "; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  document.cookie = `googtrans=${value}; path=/${exp}`;
  document.cookie = `googtrans=${value}; path=/; domain=${host}${exp}`;
  const root = host.split(".").slice(-2).join(".");
  if (root !== host) document.cookie = `googtrans=${value}; path=/; domain=.${root}${exp}`;
}

export function applyLanguage(code: string, reload = true) {
  const lang = languageByCode(code)?.code ?? DEFAULT_LANGUAGE;
  localStorage.setItem(KEY, lang);
  setCookie(lang === "en" ? "" : `/en/${lang}`);
  if (reload) window.location.reload();
}

function loadTranslator() {
  if (document.getElementById("gt-script")) return;
  const holder = document.createElement("div");
  holder.id = "google_translate_element";
  holder.style.display = "none";
  document.body.appendChild(holder);
  (window as any).googleTranslateElementInit = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google;
    new g.translate.TranslateElement(
      { pageLanguage: "en", autoDisplay: false },
      "google_translate_element",
    );
  };
  const s = document.createElement("script");
  s.id = "gt-script";
  s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  document.body.appendChild(s);
}

export function useLanguage() {
  const [lang, setLang] = useState<string | null>(null);
  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    setLang(saved);
    if (saved && saved !== "en") {
      setCookie(`/en/${saved}`);
      loadTranslator();
    }
  }, []);
  return lang;
}

/** Searchable list of every language. Shared by the footer picker and the prompt. */
function LanguagePicker({
  value,
  onPick,
  className,
  autoFocus,
}: {
  value?: string | null;
  onPick: (code: string) => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchLanguages(query), [query]);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${LANGUAGES.length} languages…`}
          aria-label="Search languages"
          className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>
      <div className="mt-2 max-h-64 flex-1 overflow-y-auto rounded-md border border-border">
        {results.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">No language found.</p>
        )}
        {results.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => onPick(l.code)}
            dir={l.rtl ? "rtl" : "ltr"}
            className={cn(
              "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/5",
              value === l.code ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span className="truncate">
              <span className="text-foreground">{l.native}</span>
              <span className="ml-2 text-xs text-muted-foreground">{l.name}</span>
            </span>
            {value === l.code && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LanguageToggle() {
  const lang = useLanguage();
  const current = lang ?? DEFAULT_LANGUAGE;
  const currentLang = languageByCode(current);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Choose language"
        aria-expanded={open}
        className="notranslate inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 hover:text-foreground"
      >
        <Languages className="h-3.5 w-3.5" />
        {currentLang?.native ?? "English"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="notranslate absolute bottom-full right-0 z-50 mb-2 w-72 rounded-lg border border-border bg-card p-3 shadow-elev">
            <p className="mb-2 text-[10px] uppercase text-muted-foreground">Language</p>
            <LanguagePicker
              value={current}
              onPick={(code) => {
                setOpen(false);
                applyLanguage(code);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** First-visit prompt asking for the preferred language. */
export function LanguagePrompt() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(KEY)) setShow(true);
  }, []);
  if (!show) return null;
  const pick = (code: string) => {
    setShow(false);
    applyLanguage(code);
  };
  return (
    <div className="notranslate fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-md space-y-4 rounded-2xl p-6">
        <Languages className="mx-auto h-8 w-8 text-primary" />
        <h2 className="text-center font-display text-lg font-semibold">
          Choose your language · 选择语言
        </h2>
        <LanguagePicker className="w-full" autoFocus onPick={pick} />
      </div>
    </div>
  );
}

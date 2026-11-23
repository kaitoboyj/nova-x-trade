import { brandLogo } from "@/lib/brand";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SubscriptionPlanLink, TransactionHistoryLink } from "@/components/SubscriptionLinks";
import { TermsAndRulesDialog } from "@/components/TermsAndRulesDialog";
import { DemoAccess } from "@/components/demo/DemoAccess";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 grid gap-10 md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <img
              src={brandLogo}
              alt="PrimeCapital"
              className="h-9 w-9 rounded-md object-contain"
            />
            <span translate="no" className="notranslate font-display text-base font-semibold">Prime<span className="text-gradient">Capital</span></span>
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            Institutional-grade crypto trading and self-custody, in one interface.
          </p>
        </div>
        <FooterCol title="Products" links={[
          ["Markets", "/markets"],
          ["Trade", "/trade"],
          ["Wallet", "/wallet"],
        ]} />
        <FooterCol title="Company" links={[["About", "/"], ["How it works", "/how-it-works"], ["Press", "/"]]} />
        <FooterCol
          title="Resources"
          links={[["How it works", "/how-it-works"], ["Docs", "/"], ["Status", "/"]]}
        >
          <TransactionHistoryLink />
        </FooterCol>
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© 2021 <span translate="no" className="notranslate">PrimeCapital</span> Labs. Trading crypto carries risk.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <SubscriptionPlanLink />
            <TermsAndRulesDialog>
              <button
                type="button"
                className="cursor-pointer transition-opacity hover:opacity-80"
              >
                Terms &amp; Conditions
              </button>
            </TermsAndRulesDialog>
            <Link to="/how-it-works" className="hover:text-foreground">How it works</Link>
            <LanguageToggle />
            <DemoAccess />
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
  children,
}: {
  title: string;
  links: [string, string][];
  children?: ReactNode;
}) {
  return (
    <div>
      <h4 className="font-display text-sm font-semibold text-foreground mb-3">{title}</h4>
      <ul className="space-y-2">
        {links.map(([label, to]) => (
          <li key={label}>
            <Link to={to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {label}
            </Link>
          </li>
        ))}
        {children}
      </ul>
    </div>
  );
}

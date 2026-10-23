import { BonusNotice } from "@/components/BonusNotice";
import { NotificationBell } from "@/components/NotificationBell";
import { AppearanceMenu } from "@/components/AppearanceMenu";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  LogOut,
  Menu,
  Plus,
  User,
  X,
  ArrowUpRight,
  Home,
  BarChart3,
  ChartCandlestick,
  ArrowLeftRight,
  Wallet,
  Newspaper,
  Bot,
  PieChart,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { brandLogo } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { useWalletAccounts, useWalletSession } from "@/hooks/useWalletSession";
import { clearSession, switchAccount } from "@/lib/wallet-auth";
import { forgetPrivateKey } from "@/lib/wallet-signer";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/markets", label: "Markets", icon: BarChart3 },
  { to: "/trade", label: "Trade", icon: ChartCandlestick },
  { to: "/swap", label: "Swap", icon: ArrowLeftRight },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/portfolio", label: "Portfolio", icon: PieChart },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/invest", label: "Invest", icon: Bot },
] as const;

export function Navbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const session = useWalletSession();
  const accounts = useWalletAccounts();
  const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
  const onSwitch = (address: string) => {
    setMenu(false);
    if (address !== session?.address) switchAccount(address);
  };
  const signOut = () => {
    if (session?.address) forgetPrivateKey(session.address);
    clearSession();
    setOpen(false);
    setMenu(false);
  };
  return (
    <header className="site-navigation sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" aria-label="PrimeCapital home" className="flex shrink-0 items-center gap-2.5">
          <img src={brandLogo} alt="PrimeCapital" className="h-12 w-12 rounded-md object-contain" />
          <span>
            <span translate="no" className="notranslate block text-base font-bold sm:text-lg">
              Prime<span className="text-primary">Capital</span>
            </span>
            <span className="mt-0.5 block text-[9px] uppercase text-muted-foreground">
              Digital asset exchange
            </span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="hidden h-full items-center gap-0.5 lg:flex">
          {NAV.map((item) => {
            const active =
              pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full items-center gap-1.5 px-2 text-xs font-medium transition-colors xl:px-3",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-primary" />}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <AppearanceMenu />
          <NotificationBell />
          {session ? (
            <div className="relative hidden sm:block">
              <Button
                variant="outline"
                onClick={() => setMenu(!menu)}
                aria-label="Switch account"
                aria-expanded={menu}
                className="h-10 bg-surface"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-3 w-3" />
                </span>
                <span className="max-w-24 truncate text-xs">{session.username}</span>
                <ChevronDown className="text-muted-foreground" />
              </Button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-elev">
                    <p className="px-3 pb-2 pt-3 text-[10px] uppercase text-muted-foreground">
                      Accounts on this device
                    </p>
                    {accounts.map((acc) => (
                      <Button
                        key={acc.address}
                        variant="ghost"
                        onClick={() => onSwitch(acc.address)}
                        className="h-auto w-full justify-between rounded-none px-3 py-3"
                      >
                        <span className="min-w-0 text-left">
                          <span className="block truncate text-xs">{acc.username}</span>
                          <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                            {short(acc.address)}
                          </span>
                        </span>
                        {acc.address === session.address && <Check className="text-primary" />}
                      </Button>
                    ))}
                    <div className="border-t border-border">
                      <Button
                        asChild
                        variant="ghost"
                        className="w-full justify-start rounded-none text-xs"
                      >
                        <Link to="/wallet" onClick={() => setMenu(false)}>
                          <Plus />
                          Add another account
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={signOut}
                        className="w-full justify-start rounded-none text-xs text-muted-foreground"
                      >
                        <LogOut />
                        Sign out
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Button asChild className="hidden h-10 text-xs sm:inline-flex">
              <Link to="/wallet">
                <Wallet />
                Get started
                <ArrowUpRight />
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      <BonusNotice address={session?.address} />
      {open && (
        <div className="border-t border-border bg-surface lg:hidden">
          <nav aria-label="Mobile navigation" className="grid grid-cols-2 gap-2 p-4">
            {NAV.map((item) => (
              <Button
                key={item.to}
                asChild
                variant={pathname === item.to ? "default" : "ghost"}
                className="h-11 justify-start"
              >
                <Link to={item.to} onClick={() => setOpen(false)}>
                  <item.icon />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
          <div className="border-t border-border p-4">
            {session ? (
              <>
                <p className="mb-2 text-[10px] uppercase text-muted-foreground">Your accounts</p>
                {accounts.map((acc) => (
                  <Button
                    key={acc.address}
                    variant="ghost"
                    onClick={() => {
                      onSwitch(acc.address);
                      setOpen(false);
                    }}
                    className="w-full justify-between"
                  >
                    <span className="truncate">{acc.username}</span>
                    {acc.address === session.address && <Check className="text-primary" />}
                  </Button>
                ))}
                <div className="mt-3 flex gap-2">
                  <Button asChild variant="outline" className="flex-1">
                    <Link to="/wallet" onClick={() => setOpen(false)}>
                      <Plus />
                      Add account
                    </Link>
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={signOut}>
                    <LogOut />
                    Sign out
                  </Button>
                </div>
              </>
            ) : (
              <Button asChild className="w-full">
                <Link to="/wallet" onClick={() => setOpen(false)}>
                  <Wallet />
                  Get started
                  <ArrowUpRight />
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

import { Brand } from "@/components/BrandText";

const PARTNERS = [
  { name: "Binance", logo: "/partners/Binance.png" },
  { name: "OKX", logo: "/partners/OKX.png" },
  { name: "CoinGecko", logo: "/partners/coingecko.webp" },
  { name: "CoinMarketCap", logo: "/partners/coinmarket_cap.webp" },
  { name: "Trust Wallet", logo: "/partners/trust_wallet.webp" },
];

/** Home: the companies that support PrimeCapital. */
export function PartnersSection() {
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Trusted partners</p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Supported by industry leaders</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            <Brand /> works alongside the names powering the global digital asset economy.
          </p>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PARTNERS.map((p) => (
            <li
              key={p.name}
              className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-6 transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg"
            >
              <img src={p.logo} alt={`${p.name} logo`} loading="lazy" className="h-12 w-12 rounded-lg object-contain transition group-hover:scale-110" />
              <span className="text-sm font-semibold">{p.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

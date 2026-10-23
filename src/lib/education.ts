// Plain-language education content shown across the product. Kept in one place
// so glossary tooltips, the tour and the risk notice stay consistent.

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    term: "Wallet",
    definition:
      "A self-custody account you control. PrimeCapital derives it in your browser, so only you hold the keys.",
  },
  {
    term: "Recovery phrase",
    definition:
      "12 or 24 words that restore full control of a wallet. Anyone who sees them owns the funds.",
  },
  {
    term: "Private key",
    definition: "The secret that signs transactions for one address. Never share it.",
  },
  {
    term: "Gas fee",
    definition:
      "A small network charge paid to miners or validators to process a transaction on-chain.",
  },
  {
    term: "Swap",
    definition: "Exchanging one token for another at the current market rate.",
  },
  {
    term: "Slippage",
    definition:
      "The difference between the price you expect and the price you get while a trade settles.",
  },
  {
    term: "Allocation",
    definition: "How your portfolio value is split across the assets you hold.",
  },
  {
    term: "24h change",
    definition: "How much an asset's price moved over the last 24 hours.",
  },
  {
    term: "APY",
    definition: "Annual percentage yield — the yearly return quoted for an investment plan.",
  },
  {
    term: "Market capitalisation",
    definition: "Price multiplied by circulating supply: the total market value of an asset.",
  },
  {
    term: "Network",
    definition:
      "The blockchain a token lives on. The same ticker on two networks is two separate assets.",
  },
  {
    term: "DCA",
    definition:
      "Dollar-cost averaging: buying a fixed amount on a schedule instead of all at once.",
  },
];

export const GLOSSARY_BY_TERM: Record<string, string> = Object.fromEntries(
  GLOSSARY.map((g) => [g.term, g.definition]),
);

export interface TourStep {
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to PrimeCapital",
    body: "A quick tour of the tools you'll use most. You can replay it any time.",
  },
  {
    title: "Your wallet, your keys",
    body: "Create or import a wallet on the Wallet page. The recovery phrase stays in your browser — back it up somewhere safe.",
  },
  {
    title: "Markets & Trade",
    body: "Track live prices with TradingView charts on Markets, compare assets, and open any coin for detail.",
  },
  {
    title: "Swap assets",
    body: "Swap one token for another, and set up recurring buys if you prefer a steady schedule over one-off trades.",
  },
  {
    title: "Portfolio at a glance",
    body: "See your combined value, allocation and 24-hour performance across every account on this device.",
  },
  {
    title: "Stay notified",
    body: "The bell in the top bar holds your price alerts and any message sent to your account.",
  },
  {
    title: "Protect withdrawals",
    body: "Set a 4-digit PIN. You'll be asked for it before any withdrawal or send leaves your wallet.",
  },
];

export const RISK_DISCLOSURE = {
  title: "Risk disclosure",
  points: [
    "Crypto assets are volatile. The value of your holdings can fall as well as rise.",
    "Nothing here is financial advice, and no return is guaranteed.",
    "You are responsible for keeping your recovery phrase and PIN private. PrimeCapital cannot recover them for you.",
    "Transactions on public blockchains are irreversible once confirmed.",
  ],
};

export const TOUR_DONE_KEY = "prime:tour:done:v1";
export const RISK_ACK_KEY = "prime:risk:ack:v1";

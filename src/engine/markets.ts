/** Rooms are markets (plan/DESIGN.md → Markets). Only the open one has agents and rounds. */
export interface Market {
  id: string;
  name: string;
  status: "open" | "coming_soon";
  region: string;
  /** One line for the home page and the room header. */
  tagline: string;
  /** The macro attributes every agent in the room shares (≤600 chars). Goes into the agent prompt. */
  summary: string;
}

export const MARKETS: Market[] = [
  {
    id: "au",
    name: "Australian market",
    status: "open",
    region: "Australia",
    tagline: "1,000 Australians: customers, investors, industry, regulators and media",
    summary:
      "Australia: 27 million people, most in a handful of big coastal cities (Sydney, Melbourne, Brisbane, Perth, Adelaide) plus a large regional population. High incomes but a high cost of living; housing, groceries and energy bills are top worries. People shop on price and are wary of hype and subscriptions. Many markets are concentrated (two supermarkets, four big banks, two telcos). Small businesses and tradies are a big part of the economy. Strong consumer protection (ACCC), privacy rules (OAIC), and sector regulators for finance, health and energy. Startup funding is thinner than in the US.",
  },
  {
    id: "jp",
    name: "Japanese market",
    status: "coming_soon",
    region: "Japan",
    tagline: "Consumers and businesses across Japan",
    summary: "",
  },
  {
    id: "global-b2b-saas",
    name: "Global B2B SaaS",
    status: "coming_soon",
    region: "Global",
    tagline: "Buyers, operators and investors in business software",
    summary: "",
  },
];

export const OPEN_MARKET = MARKETS.find((m) => m.status === "open")!;
export const getMarket = (id: string) => MARKETS.find((m) => m.id === id);

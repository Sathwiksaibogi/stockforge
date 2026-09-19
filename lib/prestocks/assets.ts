export type PreStocksAsset = {
  ticker: string;
  name: string;
  company: string;
  category: string;
  mint: string;
  productUrl: string;
};

export const PRESTOCKS_ASSETS = [
  {
    ticker: "OPENAI",
    name: "OpenAI PreStocks",
    company: "OpenAI",
    category: "AI",
    mint:
      "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
    productUrl:
      "https://prestocks.com/openai",
  },
  {
    ticker: "ANTHROPIC",
    name: "Anthropic PreStocks",
    company: "Anthropic",
    category: "AI",
    mint:
      "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw",
    productUrl:
      "https://prestocks.com/anthropic",
  },
  {
    ticker: "ANDURIL",
    name: "Anduril PreStocks",
    company: "Anduril",
    category: "Defense",
    mint:
      "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB",
    productUrl:
      "https://prestocks.com/anduril",
  },
] as const satisfies readonly PreStocksAsset[];

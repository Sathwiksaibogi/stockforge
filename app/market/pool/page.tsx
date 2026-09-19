import {
  DbcMarketClient,
} from "@/components/market/dbc-market-client";

export default function MarketPoolPage() {
  return (
    <main className="min-h-screen bg-black">
      <DbcMarketClient />
    </main>
  );
}

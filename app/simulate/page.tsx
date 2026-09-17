import {
  Suspense,
} from "react";

import {
  SimulationClient,
} from "@/components/simulation/simulation-client";

export default function SimulatePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#07090c] text-white">
          <div className="mx-auto max-w-7xl px-6 pt-40 text-sm text-zinc-500">
            Loading StockForge simulation...
          </div>
        </main>
      }
    >
      <SimulationClient />
    </Suspense>
  );
}
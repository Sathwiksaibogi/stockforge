import { Navbar } from "@/components/navbar";

export default function ExplorePage() {
  return (
    <main className="min-h-screen bg-[#07090c] text-white">
      <Navbar />

      <div className="mx-auto max-w-7xl px-6 pt-36 lg:px-8">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">
          Markets
        </p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          Explore Markets
        </h1>
      </div>
    </main>
  );
}
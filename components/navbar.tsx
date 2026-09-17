"use client";

import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";
import { Activity } from "lucide-react";

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#07090c]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10">
            <Activity className="h-5 w-5 text-emerald-400" />
          </div>

          <div>
            <div className="text-lg font-semibold tracking-tight text-white">
              StockForge
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
              Solana Markets
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <Link
            href="/explore"
            className="transition hover:text-white"
          >
            Markets
          </Link>

          <Link
            href="/create"
            className="transition hover:text-white"
          >
            Launch
          </Link>

          <Link
            href="/dashboard"
            className="transition hover:text-white"
          >
            Dashboard
          </Link>
        </nav>

        <WalletButton />
      </div>
    </header>
  );
}
"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  WalletButton,
} from "@/components/wallet-button";

const links = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Explore",
    href: "/explore",
  },
  {
    label: "Create",
    href: "/create",
  },
  {
    label: "Simulate",
    href: "/simulate",
  },
  {
    label: "Market",
    href: "/market/pool",
  },
];

export function Navbar() {
  const pathname =
    usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-white"
          >
            StockForge
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {links.map(
              ({
                label,
                href,
              }) => {
                const active =
                  pathname ===
                  href;

                return (
                  <Link
                    key={
                      href
                    }
                    href={
                      href
                    }
                    className={
                      active
                        ? "text-sm font-medium text-white"
                        : "text-sm font-medium text-zinc-500 transition hover:text-white"
                    }
                  >
                    {
                      label
                    }
                  </Link>
                );
              }
            )}
          </nav>
        </div>

        <WalletButton />
      </div>
    </header>
  );
}
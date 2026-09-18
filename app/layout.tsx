import type {
  Metadata,
} from "next";

import "./globals.css";

import "@solana/wallet-adapter-react-ui/styles.css";

import {
  Providers,
} from "@/app/providers";

import {
  Navbar,
} from "@/components/navbar";

export const metadata:
  Metadata = {
  title: "StockForge",

  description:
    "Pyth-powered equity market intelligence and Meteora Dynamic Bonding Curve infrastructure.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />

          {children}
        </Providers>
      </body>
    </html>
  );
}
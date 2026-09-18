"use client";

import { useMemo } from "react";

import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";

import {
  WalletModalProvider,
} from "@solana/wallet-adapter-react-ui";

import {
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-solflare";

import {
  SOLANA_RPC_ENDPOINT,
} from "@/lib/solana/cluster";

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  const wallets =
    useMemo(
      () => [
        new SolflareWalletAdapter(),
      ],
      []
    );

  return (
    <ConnectionProvider
      endpoint={
        SOLANA_RPC_ENDPOINT
      }
    >
      <WalletProvider
        wallets={wallets}
        autoConnect
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
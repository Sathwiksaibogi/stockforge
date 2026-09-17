"use client";

import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  async () => {
    const walletUi = await import(
      "@solana/wallet-adapter-react-ui"
    );

    return walletUi.WalletMultiButton;
  },
  {
    ssr: false,

    loading: () => (
      <button
        type="button"
        disabled
        className="h-[42px] rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-[#04110c]"
      >
        Select Wallet
      </button>
    ),
  }
);

export function WalletButton() {
  return <WalletMultiButton />;
}
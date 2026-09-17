import { clusterApiUrl } from "@solana/web3.js";

export const SOLANA_NETWORK = "devnet";

export const SOLANA_RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("devnet");
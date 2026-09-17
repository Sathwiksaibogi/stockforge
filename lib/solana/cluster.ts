import { clusterApiUrl } from "@solana/web3.js";

export const SOLANA_NETWORK = "devnet" as const;

export const SOLANA_RPC_ENDPOINT = clusterApiUrl("devnet");
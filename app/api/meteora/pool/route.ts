import {
  Connection,
} from "@solana/web3.js";

import {
  fetchStockForgePoolState,
} from "@/lib/meteora/pool-state";

import {
  SOLANA_RPC_ENDPOINT,
} from "@/lib/solana/cluster";

export const dynamic =
  "force-dynamic";

export async function GET(
  request: Request
) {
  const url =
    new URL(request.url);

  const poolAddress =
    url.searchParams.get(
      "pool"
    );

  if (!poolAddress) {
    return Response.json(
      {
        error:
          "pool query parameter is required.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const connection =
      new Connection(
        SOLANA_RPC_ENDPOINT,
        "confirmed"
      );

    const snapshot =
      await fetchStockForgePoolState({
        connection,
        poolAddress,
      });

    return Response.json(
      snapshot,
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Failed to fetch Meteora DBC pool:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown Meteora pool error.",
      },
      {
        status: 500,
      }
    );
  }
}
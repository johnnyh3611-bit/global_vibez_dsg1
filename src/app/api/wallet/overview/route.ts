import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

import { getSession } from "@/lib/auth";
import { walletHasChair } from "@/lib/dealer/chairs";

const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com";

function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? DEFAULT_RPC_URL;
}

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const hasChair = walletHasChair(session.publicKey);
  const connection = new Connection(getRpcUrl(), "confirmed");

  let solBalance = 0;
  let rpcError: string | null = null;

  try {
    const lamports = await connection.getBalance(new PublicKey(session.publicKey));
    solBalance = lamports / 1_000_000_000;
  } catch (err) {
    rpcError = err instanceof Error ? err.message : "Failed to fetch wallet balance";
  }

  return NextResponse.json({
    publicKey: session.publicKey,
    hasChair,
    chairUnitsOwned: hasChair ? 1 : 0,
    solBalance,
    rpcUrl: getRpcUrl(),
    rpcError,
  });
}

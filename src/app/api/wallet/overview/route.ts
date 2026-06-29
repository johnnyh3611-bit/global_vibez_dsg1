import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

import { getSession } from "@/lib/auth";
import { walletHasChair } from "@/lib/dealer/chairs";

const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com";
const DEFAULT_CHAIR_PRICE_USD = 20;
const DEFAULT_SOL_USD_PRICE = 100;

function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL ?? DEFAULT_RPC_URL;
}

function getChairPriceUsd(): number {
  const parsed = Number(process.env.CHAIR_PRICE_USD ?? String(DEFAULT_CHAIR_PRICE_USD));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHAIR_PRICE_USD;
}

function getSolUsdPrice(): number {
  const parsed = Number(process.env.SOL_USD_PRICE ?? String(DEFAULT_SOL_USD_PRICE));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SOL_USD_PRICE;
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
  const chairPriceUsd = getChairPriceUsd();
  const solUsdPrice = getSolUsdPrice();
  const requiredSolForChair = chairPriceUsd / solUsdPrice;

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
    chairPriceUsd,
    solUsdPrice,
    requiredSolForChair,
    hasRequiredChairFunds: solBalance >= requiredSolForChair,
    rpcUrl: getRpcUrl(),
    rpcError,
  });
}

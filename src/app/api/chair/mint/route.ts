import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";
import bs58 from "bs58";

import { getSession } from "@/lib/auth";
import { reloadChairHolders, walletHasChair } from "@/lib/dealer/chairs";

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

function parseAuthoritySecret(value: string): Uint8Array {
  const trimmed = value.trim();

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as number[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Invalid CHAIR_MINT_AUTHORITY_SECRET_KEY JSON array");
    }
    return Uint8Array.from(parsed);
  }

  return bs58.decode(trimmed);
}

function getMintAuthority(): Keypair {
  const rawSecret = process.env.CHAIR_MINT_AUTHORITY_SECRET_KEY;
  if (!rawSecret) {
    throw new Error("CHAIR_MINT_AUTHORITY_SECRET_KEY is not configured");
  }
  return Keypair.fromSecretKey(parseAuthoritySecret(rawSecret));
}

function getTreasuryPublicKey(): PublicKey {
  const rawTreasury = process.env.CHAIR_MINT_TREASURY_PUBLIC_KEY;
  if (!rawTreasury) {
    throw new Error("CHAIR_MINT_TREASURY_PUBLIC_KEY is not configured");
  }
  return new PublicKey(rawTreasury);
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (walletHasChair(session.publicKey)) {
    return NextResponse.json(
      { error: "Chair already owned", code: "CHAIR_ALREADY_OWNED" },
      { status: 409 }
    );
  }

  const chairPriceUsd = getChairPriceUsd();
  const solUsdPrice = getSolUsdPrice();
  const minimumSolRequired = chairPriceUsd / solUsdPrice;

  const connection = new Connection(getRpcUrl(), "confirmed");
  let solBalance = 0;

  try {
    const lamports = await connection.getBalance(new PublicKey(session.publicKey));
    solBalance = lamports / 1_000_000_000;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to validate wallet balance";
    return NextResponse.json(
      { error: message, code: "BALANCE_CHECK_FAILED" },
      { status: 502 }
    );
  }

  if (solBalance < minimumSolRequired) {
    return NextResponse.json(
      {
        error: "Insufficient funds for chair mint",
        code: "INSUFFICIENT_FUNDS",
        requiredUsd: chairPriceUsd,
        minimumSolRequired,
        solBalance,
      },
      { status: 402 }
    );
  }

  const transferLamports = Math.ceil(minimumSolRequired * LAMPORTS_PER_SOL);
  let txHash: string;

  try {
    const mintAuthority = getMintAuthority();
    const treasury = getTreasuryPublicKey();

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: mintAuthority.publicKey,
        toPubkey: treasury,
        lamports: transferLamports,
      })
    );

    txHash = await sendAndConfirmTransaction(connection, transaction, [mintAuthority], {
      commitment: "confirmed",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mint transaction failed";
    return NextResponse.json(
      { error: message, code: "MINT_TX_FAILED" },
      { status: 502 }
    );
  }

  // Update local ledger for Seated Ownership model.
  const ledgerPath = path.join(process.cwd(), "data", "chair-holders.txt");
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });

  const existing = fs.existsSync(ledgerPath)
    ? new Set(
        fs
          .readFileSync(ledgerPath, "utf-8")
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"))
      )
    : new Set<string>();

  if (!existing.has(session.publicKey)) {
    const prefix = fs.existsSync(ledgerPath) && fs.statSync(ledgerPath).size > 0 ? "\n" : "";
    fs.appendFileSync(ledgerPath, `${prefix}${session.publicKey}`);
    reloadChairHolders();
  }

  console.log("Minted chair for:", session.publicKey, "tx:", txHash);

  return NextResponse.json({
    success: true,
    message: "Transaction initiated",
    txHash,
    requiredUsd: chairPriceUsd,
    minimumSolRequired,
    solBalance,
  });
}

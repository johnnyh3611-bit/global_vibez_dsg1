import { NextRequest, NextResponse } from "next/server";
import { createNonce } from "@/lib/auth/nonce-store";
import { buildSignInMessage } from "@/lib/solana/verifySignature";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const publicKey = body?.publicKey;

  if (!publicKey || typeof publicKey !== "string") {
    return NextResponse.json({ error: "publicKey is required" }, { status: 400 });
  }

  const nonce = createNonce(publicKey);
  const message = buildSignInMessage(nonce);

  return NextResponse.json({ nonce, message });
}

import { NextRequest, NextResponse } from "next/server";

import {
  consumeNonce,
  createSession,
  sessionCookieOptions,
} from "@/lib/auth";
import {
  buildSignInMessage,
  verifyWalletSignature,
} from "@/lib/solana/verifySignature";
import { walletHasChair } from "@/lib/dealer/chairs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { publicKey, signature, nonce } = body ?? {};

  if (!publicKey || !signature || !nonce) {
    return NextResponse.json(
      { error: "publicKey, signature, and nonce are required" },
      { status: 400 }
    );
  }

  if (!consumeNonce(publicKey, nonce)) {
    return NextResponse.json(
      { error: "Invalid or expired nonce" },
      { status: 401 }
    );
  }

  const message = buildSignInMessage(nonce);
  const valid = verifyWalletSignature(publicKey, message, signature);

  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const token = await createSession({
    publicKey,
    hasChair: walletHasChair(publicKey),
  });
  const response = NextResponse.json({ publicKey });
  response.cookies.set(sessionCookieOptions(token));

  return response;
}

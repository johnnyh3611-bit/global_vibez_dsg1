import { NextResponse } from 'next/server';

export async function GET() {
  const required = ['CHAIR_MINT_AUTHORITY_SECRET_KEY', 'CHAIR_MINT_TREASURY_PUBLIC_KEY', 'SOLANA_RPC_URL'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    return NextResponse.json({ status: 'NOT_READY', missing }, { status: 503 });
  }

  return NextResponse.json({ status: 'READY' });
}

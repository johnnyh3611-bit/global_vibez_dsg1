import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

export function buildSignInMessage(nonce: string): string {
  return `Sign in to SolDate\n\nNonce: ${nonce}`;
}

export function verifyWalletSignature(
  publicKey: string,
  message: string,
  signatureBase58: string
): boolean {
  try {
    const pubkey = new PublicKey(publicKey);
    const messageBytes = new TextEncoder().encode(message);
    const signature = bs58.decode(signatureBase58);
    return nacl.sign.detached.verify(
      messageBytes,
      signature,
      pubkey.toBytes()
    );
  } catch {
    return false;
  }
}

/**
 * SolanaWalletProvider — wraps the app with the standard Solana wallet
 * adapter context so any page can call `useWallet()` to grab `publicKey`.
 *
 * No-op visually; just provides the React context. The connect button
 * lives in `<WalletConnectButton />` for placement flexibility.
 */
import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

const NETWORK = (process.env.REACT_APP_SOLANA_NETWORK || "devnet") as
  | "devnet"
  | "mainnet-beta"
  | "testnet";

/** Prefer an explicit RPC URL when set; fall back to public cluster endpoint. */
function resolveSolanaEndpoint(): string {
  const custom = (process.env.REACT_APP_SOLANA_RPC || process.env.REACT_APP_SOLANA_RPC_URL || "").trim();
  if (custom) return custom;
  return clusterApiUrl(NETWORK);
}

export default function SolanaWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const endpoint = useMemo(() => resolveSolanaEndpoint(), []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

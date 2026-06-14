"use client";

import { ReactNode } from "react";
import { WalletProvider } from "./WalletProvider";
import { AuthProvider } from "@/contexts/AuthContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <AuthProvider>{children}</AuthProvider>
    </WalletProvider>
  );
}

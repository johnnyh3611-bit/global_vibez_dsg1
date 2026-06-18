"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

interface AuthState {
  authenticated: boolean;
  publicKey: string | null;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: () => Promise<boolean>;
  demoSignIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const [state, setState] = useState<AuthState>({
    authenticated: false,
    publicKey: null,
    loading: true,
    signingIn: false,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setState((s) => ({
          ...s,
          authenticated: true,
          publicKey: data.publicKey,
          loading: false,
          error: null,
        }));
      } else {
        setState((s) => ({
          ...s,
          authenticated: false,
          publicKey: null,
          loading: false,
        }));
      }
    } catch {
      setState((s) => ({
        ...s,
        authenticated: false,
        publicKey: null,
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const demoSignIn = useCallback(async (): Promise<boolean> => {
    setState((s) => ({ ...s, signingIn: true, error: null }));
    try {
      const res = await fetch("/api/auth/demo-login", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Demo login failed");
      }
      await refresh();
      setState((s) => ({ ...s, signingIn: false }));
      return true;
    } catch (err) {
      setState((s) => ({
        ...s,
        signingIn: false,
        error: err instanceof Error ? err.message : "Demo login failed",
      }));
      return false;
    }
  }, [refresh]);

  const signIn = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !signMessage) {
      setState((s) => ({
        ...s,
        error: "Connect your wallet first",
      }));
      return false;
    }

    setState((s) => ({ ...s, signingIn: true, error: null }));

    try {
      const walletAddress = publicKey.toBase58();

      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: walletAddress }),
      });

      if (!nonceRes.ok) {
        throw new Error("Failed to get sign-in nonce");
      }

      const { nonce, message } = await nonceRes.json();
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: walletAddress,
          signature: bs58.encode(signature),
          nonce,
        }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error ?? "Verification failed");
      }

      await refresh();
      setState((s) => ({ ...s, signingIn: false }));
      return true;
    } catch (err) {
      setState((s) => ({
        ...s,
        signingIn: false,
        error: err instanceof Error ? err.message : "Sign-in failed",
      }));
      return false;
    }
  }, [publicKey, signMessage, refresh]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    if (connected) {
      await disconnect();
    }
    setState({
      authenticated: false,
      publicKey: null,
      loading: false,
      signingIn: false,
      error: null,
    });
  }, [connected, disconnect]);

  return (
    <AuthContext.Provider value={{ ...state, signIn, demoSignIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

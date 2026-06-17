/**
 * LedgerSignerProvider — exposes a connected Ledger Solana signer to the
 * whole app via a React context. Works alongside `<SolanaWalletProvider>`
 * (browser-extension wallets like Backpack / Solflare) — Ledger is a
 * separate signing path because the device-signer-kit is *not* a standard
 * `@solana/wallet-adapter` adapter.
 *
 * Pipeline:
 *   1. User clicks "Connect Ledger" → `connect()`.
 *   2. We build a `DeviceManagementKit` with the WebHID transport.
 *   3. User picks the Ledger from the browser permission dialog.
 *   4. We open a session, build a `SignerSolana`, and read pubkey at
 *      derivation path 44'/501'/0'/0' (Solana app default).
 *   5. Components call `useLedger()` for { connected, publicKey, signer, connect, disconnect }.
 *
 * The `signer` returned satisfies the {@link SignerSolana} interface
 * exported from `@ledgerhq/device-signer-kit-solana`. Wrap it to return
 * the same shape your existing transaction code expects, e.g. a function
 * `signTransaction(tx) → Promise<Transaction>`.
 *
 * SECURITY: This file does NOT auto-connect or auto-prompt — every action
 * requires an explicit user click, per Ledger's security guidelines.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ConsoleLogger,
  DeviceManagementKitBuilder,
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { webHidTransportFactory } from "@ledgerhq/device-transport-kit-web-hid";
import {
  SignerSolanaBuilder,
  type SignerSolana,
} from "@ledgerhq/device-signer-kit-solana";
import { PublicKey } from "@solana/web3.js";
import { firstValueFrom, filter } from "rxjs";

/** Default Solana derivation path used by every Ledger Live build. */
export const LEDGER_SOLANA_DEFAULT_PATH = "44'/501'/0'/0'";

type LedgerStatus = "idle" | "connecting" | "connected" | "error";

interface LedgerContextValue {
  status: LedgerStatus;
  /** Connected Ledger's Solana public key, or `null` until `connect()` resolves. */
  publicKey: PublicKey | null;
  /** Low-level signer — exposes `signTransaction`, `signMessage`, `getAddress`. */
  signer: SignerSolana | null;
  /** Last error message, if any (useful for surfacing to a toast). */
  error: string | null;
  /** Initiate the WebHID prompt + session bootstrap. Must be called from a user click. */
  connect: (opts?: { derivationPath?: string }) => Promise<void>;
  /** Tear down the active session — does NOT power-off the device. */
  disconnect: () => Promise<void>;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

export const useLedger = (): LedgerContextValue => {
  const ctx = useContext(LedgerContext);
  if (!ctx) {
    throw new Error(
      "useLedger() must be called inside <LedgerSignerProvider>",
    );
  }
  return ctx;
};

export default function LedgerSignerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<LedgerStatus>("idle");
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [signer, setSigner] = useState<SignerSolana | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hold the SDK + session on a ref so re-renders don't tear it down.
  const dmkRef = useRef<DeviceManagementKit | null>(null);
  const sessionIdRef = useRef<DeviceSessionId | null>(null);

  const connect = useCallback<LedgerContextValue["connect"]>(async (opts) => {
    if (typeof window === "undefined" || !("hid" in navigator)) {
      const msg =
        "WebHID is not available in this browser. Use Chrome, Edge, or Brave.";
      setError(msg);
      setStatus("error");
      throw new Error(msg);
    }

    setError(null);
    setStatus("connecting");

    try {
      // 1. Build (or reuse) the DMK.
      if (!dmkRef.current) {
        dmkRef.current = new DeviceManagementKitBuilder()
          .addLogger(new ConsoleLogger())
          .addTransport(webHidTransportFactory)
          .build();
      }
      const dmk = dmkRef.current;

      // 2. Discover devices and connect to the first one the user picks.
      //    `startDiscovering()` triggers the browser's WebHID permission dialog.
      const discovered = await firstValueFrom(
        dmk.startDiscovering({}).pipe(filter(Boolean)),
      );
      const sessionId = await dmk.connect({ device: discovered });
      sessionIdRef.current = sessionId;

      // 3. Build the Solana signer bound to this session.
      const solanaSigner = new SignerSolanaBuilder({ dmk, sessionId }).build();
      setSigner(solanaSigner);

      // 4. Read the public key at the requested derivation path.
      const path = opts?.derivationPath ?? LEDGER_SOLANA_DEFAULT_PATH;
      const addrFlow = solanaSigner.getAddress(path, { checkOnDevice: false });
      const addrResult = await firstValueFrom(
        addrFlow.observable.pipe(
          filter((s: { status: string }) => s.status === "completed"),
        ),
      );
      // `addrResult.output.address` is base58 on Solana — narrow the type
      // through `unknown` since the kit's union state type doesn't expose
      // ``output`` on the `pending` branches.
      const addr = (addrResult as unknown as { output: { address: string } }).output.address;
      setPublicKey(new PublicKey(addr));

      setStatus("connected");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to connect to Ledger device";
      setError(msg);
      setStatus("error");
      // Re-throw so callers can show their own UX.
      throw err;
    }
  }, []);

  const disconnect = useCallback<LedgerContextValue["disconnect"]>(async () => {
    try {
      if (dmkRef.current && sessionIdRef.current) {
        await dmkRef.current.disconnect({ sessionId: sessionIdRef.current });
      }
    } finally {
      sessionIdRef.current = null;
      setSigner(null);
      setPublicKey(null);
      setStatus("idle");
      setError(null);
    }
  }, []);

  const value = useMemo<LedgerContextValue>(
    () => ({ status, publicKey, signer, error, connect, disconnect }),
    [status, publicKey, signer, error, connect, disconnect],
  );

  return (
    <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>
  );
}

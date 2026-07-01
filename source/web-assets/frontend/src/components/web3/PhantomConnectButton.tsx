/**
 * PhantomConnectButton — opens the Phantom Connect modal so a user can
 * sign in with Google / Apple / Phantom and receive a non-custodial
 * Solana wallet inside the app. Drop this anywhere a connect CTA is
 * needed (Treasury page, Onboarding, Wallet panel).
 *
 * When already connected, it renders a compact pill with the user's
 * truncated Solana pubkey and a "Disconnect" affordance.
 */
import React from "react";
import {
  useConnect,
  useDisconnect,
  useAccounts,
  useModal,
} from "@phantom/react-sdk";

function truncate(addr: string, head = 4, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

interface PhantomConnectButtonProps {
  className?: string;
  /** Override the default label shown when disconnected. */
  label?: string;
}

export default function PhantomConnectButton({
  className = "",
  label = "Connect Wallet",
}: PhantomConnectButtonProps) {
  const { open } = useModal();
  const { isConnecting, error: connectError } = useConnect();
  const { disconnect, isDisconnecting } = useDisconnect();
  const accounts = useAccounts();

  const solanaAddress = React.useMemo(() => {
    if (!accounts || !Array.isArray(accounts)) return null;
    const found = accounts.find(
      (a: { addressType?: string; address?: string }) =>
        a?.addressType === "solana" || a?.addressType === "Solana",
    );
    return found?.address || null;
  }, [accounts]);

  const isConnected = Boolean(solanaAddress);

  if (isConnected) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300 ${className}`}
        data-testid="phantom-connect-status"
      >
        <span
          className="h-2 w-2 rounded-full bg-emerald-400"
          aria-hidden="true"
        />
        <code
          className="font-mono text-xs"
          title={solanaAddress || ""}
          data-testid="phantom-connected-address"
        >
          {truncate(solanaAddress!)}
        </code>
        <button
          type="button"
          onClick={() => {
            void disconnect();
          }}
          disabled={isDisconnecting}
          className="ml-1 rounded-full px-2 py-0.5 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
          data-testid="phantom-disconnect-button"
        >
          {isDisconnecting ? "…" : "Disconnect"}
        </button>
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => open()}
        disabled={isConnecting}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 transition hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-60"
        data-testid="phantom-connect-button"
      >
        {isConnecting ? "Connecting…" : label}
      </button>
      {connectError && (
        <span
          className="text-xs text-red-400"
          data-testid="phantom-connect-error"
        >
          {connectError.message}
        </span>
      )}
    </div>
  );
}
